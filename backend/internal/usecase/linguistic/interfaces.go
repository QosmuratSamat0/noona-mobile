package linguistic

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type LinguisticRepo interface {
	SaveTranscript(ctx context.Context, t *domain.Transcript) error
	GetTranscriptByMessageID(ctx context.Context, messageID string, userID string) (*domain.Transcript, error)

	SaveCorrection(ctx context.Context, c *domain.Correction) error
	GetCorrectionsByTranscriptID(ctx context.Context, transcriptID string) ([]*domain.Correction, error)

	CreateMistake(ctx context.Context, m domain.MistakeModel) error
	GetMistakesByUserID(ctx context.Context, userID string) ([]*domain.MistakeModel, error)

	UpdateCEFRLevel(ctx context.Context, userID string, level string) error
}
