package learning

type WordUsage struct {
	Word       string
	Normalized string
	IsNew      bool
}

type VocabularyStats struct {
	TotalWords    int
	UniqueWords   int
	NewWords      []string
	RepeatedWords []string
	OverusedWords []WordSuggestion
}

type WordSuggestion struct {
	Word         string
	Alternatives []string
}
