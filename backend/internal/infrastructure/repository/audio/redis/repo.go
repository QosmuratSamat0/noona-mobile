package redis

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
	"github.com/redis/go-redis/v9"
)

type JobRepo struct {
	client    *redis.Client
	queueName string
}

func NewJobRepo(client *redis.Client, queueName string) *JobRepo {
	return &JobRepo{
		client:    client,
		queueName: queueName,
	}
}

func (r *JobRepo) CreateJob(ctx context.Context, job audio.Job) error {
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	err = r.client.RPush(ctx, r.queueName, data).Err()
	if err != nil {
		return fmt.Errorf("failed to push job to redis: %w", err)
	}

	return nil
}
