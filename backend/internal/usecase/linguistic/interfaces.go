package linguistic

import (
	"context"
)

type LLMProvider interface {
	Translate(ctx context.Context, text, targetLang string) (string, error)
}
