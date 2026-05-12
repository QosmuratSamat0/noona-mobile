package audio

import (
	"context"
	"io"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
)

type StorageRepo interface {
	UploadFile(ctx context.Context, file io.Reader, fileSize int64, contentType, ext string) (string, error)
	DeleteFile(ctx context.Context, filePath string) error
}

type JobRepo interface {
	CreateJob(ctx context.Context, job audio.Job) error
}

type ActivityUseCase interface {
	RecordActivity(ctx context.Context, userID string) error
}

type STTService interface {
	Transcribe(ctx context.Context, audioPath string) (string, error)
}

type LLMService interface {
	Analyze(ctx context.Context, transcript string) (string, error)
}

type TTSService interface {
	GenerateAudio(ctx context.Context, text string) (string, error)
}

type WSPusher interface {
	PushToUser(userID string, payload any) error
}

type Processor interface {
	ProcessJob(ctx context.Context, job audio.Job) error
}
