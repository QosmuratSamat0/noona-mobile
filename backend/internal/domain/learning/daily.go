package learning

import "time"

type DailySession struct {
	ID                  string
	UserID              string
	Date                time.Time
	StartedAt           time.Time
	EndedAt             *time.Time
	DurationSeconds     int
	TotalResults        int
	TotalWords          int
	UniqueWords         int
	NewWordsCount       int
	MistakesCount       int
	GrammarErrors       int
	VocabularyErrors    int
	PronunciationErrors int
	AvgScore            int
	CEFRLevel           string
	MainWeakPoint       string
	Summary             string
	NextStep            string
}

type DailySummary struct {
	ID                 string
	UserID             string
	Date               time.Time
	SessionsCount      int
	TotalWords         int
	NewWordsCount      int
	MistakesCount      int
	FixedMistakesCount int
	AvgScore           int
	WeakPoint          string
	SummaryText        string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

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
