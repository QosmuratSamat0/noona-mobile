package practice

import (
	"context"
	"io"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/results"
)

type STTService interface {
	TranscribeReader(ctx context.Context, audio io.Reader, language string) (string, error)
}

type AudioStorage interface {
	UploadFile(ctx context.Context, file io.Reader, fileSize int64, contentType, ext string) (string, error)
	FileURL(ctx context.Context, filePath string) (string, error)
}

type ResultService interface {
	Create(ctx context.Context, input results.CreateInput) (*learning.ResultView, error)
}

type LinguisticService interface {
	Analyze(ctx context.Context, text string) (*linguistic.AIAnalysis, error)
}

type MistakeMemoryService interface {
	UpsertFromMistakes(ctx context.Context, userID string, mistakes []learning.Mistake) ([]learning.MistakeMemory, error)
}

type DrillsService interface {
	GenerateForMemories(ctx context.Context, userID string, memories []learning.MistakeMemory) ([]learning.Drill, error)
}

type VocabularyService interface {
	TrackTranscript(ctx context.Context, userID, resultID, transcriptID, text string) (learning.VocabularyStats, error)
}

type DailyService interface {
	EnsureSession(ctx context.Context, userID, sessionID string) (*learning.DailySession, error)
	ApplyResult(ctx context.Context, sessionID string, metrics learning.ResultMetrics) error
}

type ActivityService interface {
	RecordActivity(ctx context.Context, userID string) error
}
