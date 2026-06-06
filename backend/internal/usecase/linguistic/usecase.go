package linguistic

import (
	"context"
	"fmt"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type UseCase struct {
	llm LLMProvider
}

func NewUseCase(llm ...LLMProvider) *UseCase {
	uc := &UseCase{}
	if len(llm) > 0 {
		uc.llm = llm[0]
	}
	return uc
}

func (uc *UseCase) Analyze(ctx context.Context, text string) (*linguistic.AIAnalysis, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("text is required")
	}
	if uc.llm == nil {
		return nil, fmt.Errorf("linguistic analysis provider is not configured")
	}
	return uc.llm.Analyze(ctx, text)
}

func (uc *UseCase) Translate(ctx context.Context, text, targetLang string) (string, error) {
	if uc.llm == nil {
		return "", fmt.Errorf("translation provider is not configured")
	}
	targetLang = strings.ToLower(strings.TrimSpace(targetLang))
	if targetLang != "ru" && targetLang != "kk" {
		return "", fmt.Errorf("unsupported target language")
	}
	return uc.llm.Translate(ctx, strings.TrimSpace(text), targetLang)
}
