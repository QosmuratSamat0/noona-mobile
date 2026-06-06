package results

import "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"

type CreateInput struct {
	UserID             string
	DailySessionID     string
	OriginalText       string
	CorrectedText      string
	AudioURL           string
	Score              int
	CEFRLevel          string
	FluencyScore       int
	GrammarScore       int
	VocabularyScore    int
	PronunciationScore int
	Summary            string
	NextStep           string
	Mistakes           []learning.Mistake
	Vocabulary         learning.VocabularyStats
}
