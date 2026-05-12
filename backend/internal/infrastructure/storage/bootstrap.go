package storage

import (
	"context"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/pkg/storage"
)

// InitStorage ensures all application-specific buckets exist in MinIO.
func InitStorage(mc *storage.MinioClient) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	buckets := []string{"voice-input", "voice-output"}
	for _, bucket := range buckets {
		if err := mc.EnsureBucket(ctx, bucket); err != nil {
			return err
		}
	}
	return nil
}
