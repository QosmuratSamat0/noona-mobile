package vocabulary

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Repository interface {
	TrackWords(ctx context.Context, userID, resultID, transcriptID string, words []learning.WordUsage) error
	GetResultStats(ctx context.Context, userID, resultID string) (learning.VocabularyStats, error)
	GetTodayStats(ctx context.Context, userID string) (learning.VocabularyStats, error)
}
