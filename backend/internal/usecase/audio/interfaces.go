package audio

import (
	"context"
	"io"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
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

type LLMProvider interface {
	// StreamReply возвращает канал с текстом ответа в реальном времени.
	// Это нужно для быстрого вывода в UI и озвучки.
	StreamReply(ctx context.Context, transcript string) (<-chan string, error)

	// Analyze выполняет тяжелый семантический разбор.
	// Возвращает структуру Analysis (обычно через JSON Mode).
	Analyze(ctx context.Context, transcript string) (*linguistic.AIAnalysis, error)
}

type TTSService interface {
	GenerateAudio(ctx context.Context, text string) (string, error)
}

type WSPusher interface {
	PushToUser(ctx context.Context, userID string, payload any) error
}

type Processor interface {
	ProcessJob(ctx context.Context, job audio.Job) error
}
