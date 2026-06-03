package learning

import "time"

type Mistake struct {
	ID            string
	UserID        string
	ResultID      string
	TranscriptID  string
	Type          string
	PatternKey    string
	Title         string
	OriginalText  string
	CorrectedText string
	Explanation   string
	MemoryMessage string
	CreatedAt     time.Time
}

type MistakeMemory struct {
	ID                string
	UserID            string
	PatternKey        string
	Type              string
	Title             string
	Description       string
	TotalCount        int
	RecentCount       int
	FirstSeenAt       time.Time
	LastSeenAt        time.Time
	Status            string
	LastOriginalText  string
	LastCorrectedText string
	UpdatedAt         time.Time
}

type MemorySummary struct {
	TopMistakes []MistakeMemory
	Improving   []MistakeMemory
	Fixed       []MistakeMemory
}

type MistakeView struct {
	PatternKey  string `json:"pattern_key"`
	Title       string `json:"title"`
	TotalCount  int    `json:"total_count"`
	RecentCount int    `json:"recent_count"`
	Status      string `json:"status"`
	Message     string `json:"message"`
}
