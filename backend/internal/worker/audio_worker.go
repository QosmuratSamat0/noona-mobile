package worker

import (
	"context"
	"encoding/json"
	"log/slog"
	"math/rand/v2"
	"sync"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/audio"
	"github.com/redis/go-redis/v9"
)

type AudioWorker struct {
	redisClient *redis.Client
	processor   audio.Processor
	queueName   string
	numWorkers  int
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewAudioWorker(
	redisClient *redis.Client,
	processor audio.Processor,
	queueName string,
	numWorkers int,
) *AudioWorker {
	ctx, cancel := context.WithCancel(context.Background())
	return &AudioWorker{
		redisClient: redisClient,
		processor:   processor,
		queueName:   queueName,
		numWorkers:  numWorkers,
		ctx:         ctx,
		cancel:      cancel,
	}
}

func (w *AudioWorker) Start() {
	slog.Info("starting audio worker pool", "workers", w.numWorkers)
	for i := 0; i < w.numWorkers; i++ {
		w.wg.Add(1)
		go w.worker(i)
	}
}

func (w *AudioWorker) Stop() {
	slog.Info("stopping audio worker pool")
	w.cancel()
	w.wg.Wait()
	slog.Info("audio worker pool stopped")
}

const (
	workerMaxBackoff       = 30 * time.Second
	workerBaseJitter       = time.Second
	workerMaxRetryExponent = 5 // caps exponential backoff at 2^5 = 32 seconds before the 30s ceiling
	cleanupMaxRetries      = 3
	cleanupRetryDelay      = 500 * time.Millisecond
)

func (w *AudioWorker) worker(id int) {
	defer w.wg.Done()
	slog.Info("audio worker started", "worker_id", id)

	inProgressQueue := w.queueName + ":in_progress"
	dlqQueue := w.queueName + ":dlq"

	consecutiveErrors := 0

	for {
		select {
		case <-w.ctx.Done():
			slog.Info("audio worker stopping", "worker_id", id)
			return
		default:
			jobData, err := w.redisClient.BLMove(w.ctx, w.queueName, inProgressQueue, "LEFT", "RIGHT", 2*time.Second).Result()
			if err != nil {
				if err == redis.Nil || err == context.Canceled {
					consecutiveErrors = 0
					continue
				}
				consecutiveErrors++
				backoff := min(time.Duration(1<<uint(min(consecutiveErrors-1, workerMaxRetryExponent)))*time.Second, workerMaxBackoff)
				jitter := time.Duration(rand.Int64N(int64(workerBaseJitter)))
				slog.Error("error moving job from redis", "error", err, "worker_id", id, "backoff", backoff+jitter)
				select {
				case <-time.After(backoff + jitter):
				case <-w.ctx.Done():
					return
				}
				continue
			}
			consecutiveErrors = 0

			if jobData == "" {
				continue
			}

			var job domain.Job
			if err := json.Unmarshal([]byte(jobData), &job); err != nil {
				slog.Error("failed to unmarshal job", "error", err, "worker_id", id)
				w.moveToDLQ(jobData, inProgressQueue, dlqQueue)
				continue
			}

			if err := w.processor.ProcessJob(w.ctx, job); err != nil {
				slog.Error("processor failed to process job", "job_id", job.JobID, "error", err)
				w.moveToDLQ(jobData, inProgressQueue, dlqQueue)
			} else {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				w.removeFromInProgress(cleanupCtx, inProgressQueue, jobData, "processed job")
				cancel()
			}
		}
	}
}

func (w *AudioWorker) removeFromInProgress(ctx context.Context, inProgressQueue, jobData, reason string) {
	var removed int64
	var err error

	for attempt := 0; attempt < cleanupMaxRetries; attempt++ {
		removed, err = w.redisClient.LRem(ctx, inProgressQueue, 1, jobData).Result()
		if err == nil {
			break
		}

		if attempt < cleanupMaxRetries-1 {
			slog.Warn("failed to remove job from in-progress queue, retrying",
				"error", err,
				"queue", inProgressQueue,
				"reason", reason,
				"attempt", attempt+1,
				"max_retries", cleanupMaxRetries)

			timer := time.NewTimer(cleanupRetryDelay)
			select {
			case <-timer.C:
			case <-ctx.Done():
				timer.Stop()
				slog.Error("context canceled during cleanup retry", "queue", inProgressQueue, "reason", reason)
				return
			}
		}
	}

	if err != nil {
		slog.Error("failed to remove job from in-progress queue after retries",
			"error", err,
			"queue", inProgressQueue,
			"reason", reason,
			"attempts", cleanupMaxRetries)
		return
	}

	if removed == 0 {
		slog.Error("job was not found in in-progress queue (possible race or duplicate cleanup)", "queue", inProgressQueue, "reason", reason)
	}
}

func (w *AudioWorker) moveToDLQ(jobData, inProgressQueue, dlqQueue string) {
	cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := w.redisClient.RPush(cleanupCtx, dlqQueue, jobData).Err()
	if err == nil {
		w.removeFromInProgress(cleanupCtx, inProgressQueue, jobData, "moved to DLQ")
	} else {
		slog.Error("failed to move job to DLQ", "error", err)
	}
}
