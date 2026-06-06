package analysis

import (
	"context"

	activityDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type MemoryReader interface {
	ListSummary(ctx context.Context, userID string) (*learning.MemorySummary, error)
}

type VocabularyReader interface {
	GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error)
}

type DailyReader interface {
	Today(ctx context.Context, userID string) (*learning.DailySession, error)
}

type ResultsReader interface {
	ListRecent(ctx context.Context, userID string, limit int) ([]learning.Result, error)
}

type ActivityReader interface {
	GetActivity(ctx context.Context, userID string) (*activityDomain.Streak, []*activityDomain.DailyStat, error)
}
