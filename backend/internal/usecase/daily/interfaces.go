package daily

import (
	"context"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Repository interface {
	StartSession(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error)
	FinishSession(ctx context.Context, userID, sessionID string, endedAt time.Time) (*learning.DailySession, error)
	GetSession(ctx context.Context, userID, sessionID string) (*learning.DailySession, error)
	GetByDate(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error)
	GetTodayOpenSession(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error)
	UpdateAfterResult(ctx context.Context, sessionID string, metrics learning.ResultMetrics) error
}
