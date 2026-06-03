package learning

type AnalysisSummary struct {
	Focus       string          `json:"focus"`
	Reason      string          `json:"reason"`
	NextSteps   []string        `json:"next_steps"`
	TopMistakes []MistakeView   `json:"top_mistakes"`
	Vocabulary  VocabularyStats `json:"vocabulary"`
	Daily       *DailySession   `json:"daily,omitempty"`
}
