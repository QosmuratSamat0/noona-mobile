package analysis

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type MemoryService interface {
	ListSummary(ctx context.Context, userID string) (*learning.MemorySummary, error)
}

type VocabularyService interface {
	GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error)
}

type DailyService interface {
	Today(ctx context.Context, userID string) (*learning.DailySession, error)
}
