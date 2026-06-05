package mistake_memory

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Repository interface {
	GetByPattern(ctx context.Context, userID, patternKey string) (*learning.MistakeMemory, error)
	Create(ctx context.Context, memory *learning.MistakeMemory) error
	Update(ctx context.Context, memory *learning.MistakeMemory) error
	ListByUser(ctx context.Context, userID string) ([]learning.MistakeMemory, error)
}
