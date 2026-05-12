package worker

import (
	"context"
	"encoding/json"
	"log/slog"
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

func (w *AudioWorker) worker(id int) {
	defer w.wg.Done()
	slog.Info("audio worker started", "worker_id", id)

	inProgressQueue := w.queueName + ":in_progress"
	dlqQueue := w.queueName + ":dlq"

	for {
		select {
		case <-w.ctx.Done():
			slog.Info("audio worker stopping", "worker_id", id)
			return
		default:
			jobData, err := w.redisClient.BLMove(w.ctx, w.queueName, inProgressQueue, "LEFT", "RIGHT", 2*time.Second).Result()
			if err != nil {
				if err != redis.Nil && err != context.Canceled {
					slog.Error("error moving job from redis", "error", err, "worker_id", id)
				}
				continue
			}

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
				w.redisClient.LRem(cleanupCtx, inProgressQueue, 1, jobData)
				cancel()
			}
		}
	}
}

func (w *AudioWorker) moveToDLQ(jobData, inProgressQueue, dlqQueue string) {
	cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := w.redisClient.RPush(cleanupCtx, dlqQueue, jobData).Err()
	if err == nil {
		w.redisClient.LRem(cleanupCtx, inProgressQueue, 1, jobData)
	} else {
		slog.Error("failed to move job to DLQ", "error", err)
	}
}
