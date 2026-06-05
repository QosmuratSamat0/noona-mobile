package drills

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Repository interface {
	HasPendingForPattern(ctx context.Context, userID, patternKey string) (bool, error)
	CreateDrill(ctx context.Context, drill *learning.Drill) error
	ListDrillsByUser(ctx context.Context, userID string) ([]learning.Drill, error)
}
