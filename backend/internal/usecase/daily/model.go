package daily

type ResultMetrics struct {
	TotalWords          int
	UniqueWords         int
	NewWordsCount       int
	MistakesCount       int
	GrammarErrors       int
	VocabularyErrors    int
	PronunciationErrors int
	Score               int
	CEFRLevel           string
	MainWeakPoint       string
	NextStep            string
}
