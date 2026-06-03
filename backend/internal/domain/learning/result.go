package learning

import "time"

type Result struct {
	ID                 string
	UserID             string
	TranscriptID       string
	DailySessionID     string
	OriginalText       string
	CorrectedText      string
	Score              int
	CEFRLevel          string
	FluencyScore       int
	GrammarScore       int
	VocabularyScore    int
	PronunciationScore int
	Summary            string
	NextStep           string
	CreatedAt          time.Time
}

type SpeakingQuality struct {
	FluencyScore int
	AnswerLength string
	Message      string
}

type ResultBundleInput struct {
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
	Mistakes           []Mistake
}

type ResultBundle struct {
	Transcript Transcript
	Result     Result
	Mistakes   []Mistake
}

type ResultView struct {
	Result          Result
	Mistakes        []Mistake
	Vocabulary      VocabularyStats
	SpeakingQuality SpeakingQuality
	NextSteps       []string
}
