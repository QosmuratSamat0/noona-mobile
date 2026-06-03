package http

import (
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type ResultResponse struct {
	ResultID        string                   `json:"result_id"`
	OriginalText    string                   `json:"original_text"`
	CorrectedText   string                   `json:"corrected_text"`
	Score           int                      `json:"score"`
	CEFRLevel       string                   `json:"cefr_level"`
	Mistakes        []MistakeResponse        `json:"mistakes"`
	Vocabulary      learning.VocabularyStats `json:"vocabulary"`
	SpeakingQuality learning.SpeakingQuality `json:"speaking_quality"`
	NextSteps       []string                 `json:"next_steps"`
}

type MistakeResponse struct {
	Type          string `json:"type"`
	PatternKey    string `json:"pattern_key"`
	Title         string `json:"title"`
	OriginalText  string `json:"original_text"`
	CorrectedText string `json:"corrected_text"`
	Explanation   string `json:"explanation"`
	MemoryMessage string `json:"memory_message,omitempty"`
}

type DailySessionResponse struct {
	SessionID       string     `json:"session_id"`
	Date            string     `json:"date"`
	StartedAt       time.Time  `json:"started_at"`
	EndedAt         *time.Time `json:"ended_at"`
	TotalResults    int        `json:"total_results"`
	TotalWords      int        `json:"total_words"`
	NewWordsCount   int        `json:"new_words_count"`
	MistakesCount   int        `json:"mistakes_count"`
	AvgScore        int        `json:"avg_score"`
	MainWeakPoint   string     `json:"main_weak_point"`
	Summary         string     `json:"summary"`
	NextStep        string     `json:"next_step"`
	DurationSeconds int        `json:"duration_seconds"`
}

func toResultResponse(view *learning.ResultView) ResultResponse {
	mistakes := make([]MistakeResponse, 0, len(view.Mistakes))
	for _, mistake := range view.Mistakes {
		mistakes = append(mistakes, MistakeResponse{
			Type:          mistake.Type,
			PatternKey:    mistake.PatternKey,
			Title:         mistake.Title,
			OriginalText:  mistake.OriginalText,
			CorrectedText: mistake.CorrectedText,
			Explanation:   mistake.Explanation,
			MemoryMessage: mistake.MemoryMessage,
		})
	}
	return ResultResponse{
		ResultID:        view.Result.ID,
		OriginalText:    view.Result.OriginalText,
		CorrectedText:   view.Result.CorrectedText,
		Score:           view.Result.Score,
		CEFRLevel:       view.Result.CEFRLevel,
		Mistakes:        mistakes,
		Vocabulary:      view.Vocabulary,
		SpeakingQuality: view.SpeakingQuality,
		NextSteps:       view.NextSteps,
	}
}

func toDailyResponse(session *learning.DailySession) *DailySessionResponse {
	if session == nil {
		return nil
	}
	return &DailySessionResponse{
		SessionID:       session.ID,
		Date:            session.Date.Format("2006-01-02"),
		StartedAt:       session.StartedAt,
		EndedAt:         session.EndedAt,
		TotalResults:    session.TotalResults,
		TotalWords:      session.TotalWords,
		NewWordsCount:   session.NewWordsCount,
		MistakesCount:   session.MistakesCount,
		AvgScore:        session.AvgScore,
		MainWeakPoint:   session.MainWeakPoint,
		Summary:         session.Summary,
		NextStep:        session.NextStep,
		DurationSeconds: session.DurationSeconds,
	}
}
