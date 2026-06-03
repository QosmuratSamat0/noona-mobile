package http

import (
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/go-chi/chi/v5"
)

type LearningModule struct {
	practice *PracticeHandler
	daily    *DailyHandler
	results  *ResultsHandler
	insights *InsightsHandler
}

func NewLearningModule(practice PracticeUseCase, daily DailyUseCase, results ResultsUseCase, memory MistakeMemoryUseCase, vocabulary VocabularyUseCase, analysis AnalysisUseCase) *LearningModule {
	return &LearningModule{
		practice: NewPracticeHandler(practice),
		daily:    NewDailyHandler(daily),
		results:  NewResultsHandler(results),
		insights: NewInsightsHandler(memory, vocabulary, analysis),
	}
}

func (m *LearningModule) RegisterRoutes(r chi.Router, secret string) {
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(secret))

		r.Post("/daily-sessions/start", m.daily.Start)
		r.Post("/daily-sessions/{id}/finish", m.daily.Finish)
		r.Get("/daily-sessions/today", m.daily.Today)
		r.Get("/daily-sessions", m.daily.ByDate)

		r.Post("/practice/audio", m.practice.SubmitAudio)
		r.Post("/practice/text", m.practice.SubmitText)

		r.Get("/results/{id}", m.results.Get)
		r.Get("/results", m.results.List)

		r.Get("/mistake-memory/me", m.insights.MistakeMemory)
		r.Get("/vocabulary/today", m.insights.VocabularyToday)
		r.Get("/analysis/me", m.insights.AnalysisMe)
	})
}
