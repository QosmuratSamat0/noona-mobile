package audio

import (
	"context"
	"io"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
)

type StorageRepo interface {
	UploadFile(ctx context.Context, file io.Reader, fileSize int64, contentType, ext string) (string, error)
}

type JobRepo interface {
	CreateJob(ctx context.Context, job audio.Job) error
}

type ActivityUseCase interface {
	RecordActivity(ctx context.Context, userID string) error
}
