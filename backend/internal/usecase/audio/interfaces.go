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

type LinguisticUseCase interface {
	SaveTranscript(ctx context.Context, messageID, rawText string) (*linguistic.Transcript, error)
	GetTranscript(ctx context.Context, userID, messageID string) (*linguistic.Transcript, error)
	SaveCorrection(ctx context.Context, transcriptID, correctedText, explanation, cefrLevel string) (*linguistic.Correction, error)
	GetCorrections(ctx context.Context, transcriptID string) ([]*linguistic.Correction, error)
	SaveMistake(ctx context.Context, userID, mistakeType, original, corrected string, offset int) (*linguistic.MistakeModel, error)
	GetUserMistakes(ctx context.Context, userID string) ([]*linguistic.MistakeModel, error)
	UpdateCEFRLevel(ctx context.Context, userID, level string) error
}

type STTService interface {
	Transcribe(ctx context.Context, audioPath string) (string, error)
}

type LLMProvider interface {
	StreamReply(ctx context.Context, transcript string) (<-chan string, error)
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
