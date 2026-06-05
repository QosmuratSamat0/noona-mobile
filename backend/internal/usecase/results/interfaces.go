package results

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	linguisticDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/daily"
)

type Repository interface {
	CreateBundle(ctx context.Context, input learning.ResultBundleInput) (*learning.ResultBundle, error)
	GetResult(ctx context.Context, userID, resultID string) (*learning.Result, error)
	GetMistakesByResult(ctx context.Context, userID, resultID string) ([]learning.Mistake, error)
	ListResults(ctx context.Context, userID, sessionID string) ([]learning.Result, error)
}

type LLMProvider interface {
	Analyze(ctx context.Context, transcript string) (*linguisticDomain.AIAnalysis, error)
}

type MemoryService interface {
	UpsertFromMistakes(ctx context.Context, userID string, mistakes []learning.Mistake) ([]learning.MistakeMemory, error)
}

type DrillService interface {
	GenerateForMemories(ctx context.Context, userID string, memories []learning.MistakeMemory) ([]learning.Drill, error)
}

type VocabularyService interface {
	TrackTranscript(ctx context.Context, userID, resultID, transcriptID, text string) (learning.VocabularyStats, error)
	GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error)
}

type DailyService interface {
	EnsureSession(ctx context.Context, userID, sessionID string) (*learning.DailySession, error)
	ApplyResult(ctx context.Context, sessionID string, metrics daily.ResultMetrics) error
}

type ActivityService interface {
	RecordActivity(ctx context.Context, userID string) error
}
