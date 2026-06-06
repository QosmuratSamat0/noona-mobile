package results

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Repository interface {
	CreateBundle(ctx context.Context, input learning.ResultBundleInput) (*learning.ResultBundle, error)
	GetResult(ctx context.Context, userID, resultID string) (*learning.Result, error)
	ListResults(ctx context.Context, userID, sessionID string) ([]learning.Result, error)
	ListRecentResults(ctx context.Context, userID string, limit int) ([]learning.Result, error)
}

type MistakesRepository interface {
	CreateForResult(ctx context.Context, userID, resultID, transcriptID string, mistakes []learning.Mistake) ([]learning.Mistake, error)
	GetByResult(ctx context.Context, userID, resultID string) ([]learning.Mistake, error)
}

type VocabularyReader interface {
	GetResultStats(ctx context.Context, userID, resultID string) (learning.VocabularyStats, error)
}
