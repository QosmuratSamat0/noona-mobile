package activity

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
)

type ActivityRepo interface {
	IncrementDailySession(ctx context.Context, userID string) error
	GetDailyStats(ctx context.Context, userID string) ([]*domain.DailyStat, error)

	GetStreak(ctx context.Context, userID string) (*domain.Streak, error)
	UpdateStreak(ctx context.Context, userID string) error
}
