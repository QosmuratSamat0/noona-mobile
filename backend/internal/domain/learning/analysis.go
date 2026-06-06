package learning

import "time"

type AnalysisSummary struct {
	Focus              string          `json:"focus"`
	Reason             string          `json:"reason"`
	NextSteps          []string        `json:"next_steps"`
	TopMistakes        []MistakeView   `json:"top_mistakes"`
	FixedMistakes      []MistakeView   `json:"fixed_mistakes"`
	TodayPlan          []string        `json:"today_plan"`
	Vocabulary         VocabularyStats `json:"vocabulary"`
	SkillProgress      SkillProgress   `json:"skill_progress"`
	Activity           ActivitySummary `json:"activity"`
	RecentResults      []ResultInsight `json:"recent_results"`
	NextRecommendation string          `json:"next_recommendation"`
	Daily              *DailySession   `json:"daily,omitempty"`
}

type SkillProgress struct {
	TotalResults     int        `json:"total_results"`
	AverageScore     int        `json:"average_score"`
	CurrentCEFRLevel string     `json:"current_cefr_level"`
	LastResultAt     *time.Time `json:"last_result_at,omitempty"`
}

type ActivitySummary struct {
	CurrentStreak    int        `json:"current_streak"`
	LongestStreak    int        `json:"longest_streak"`
	LastActivityDate *time.Time `json:"last_activity_date,omitempty"`
	SessionsCount    int        `json:"sessions_count"`
	ActiveDays       int        `json:"active_days"`
}

type ResultInsight struct {
	ResultID      string    `json:"result_id"`
	OriginalText  string    `json:"original_text"`
	CorrectedText string    `json:"corrected_text"`
	Score         int       `json:"score"`
	CEFRLevel     string    `json:"cefr_level"`
	CreatedAt     time.Time `json:"created_at"`
}
