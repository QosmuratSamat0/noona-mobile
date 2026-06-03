package linguistic

import (
	"context"
	"fmt"
	"strings"
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
