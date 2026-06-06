package linguistic

import (
	"context"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type LLMProvider interface {
	Analyze(ctx context.Context, transcript string) (*linguistic.AIAnalysis, error)
	Translate(ctx context.Context, text, targetLang string) (string, error)
}
