package linguistic

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type LinguisticRepo interface {
	SaveTranscript(ctx context.Context, t *domain.Transcript) error
	GetTranscriptByMessageID(ctx context.Context, messageID string) (*domain.Transcript, error)

	SaveCorrection(ctx context.Context, c *domain.Correction) error
	GetCorrectionsByTranscriptID(ctx context.Context, transcriptID string) ([]*domain.Correction, error)

	SaveMistake(ctx context.Context, m *domain.Mistake) error
	GetUserMistakes(ctx context.Context, userID string) ([]*domain.Mistake, error)
}
