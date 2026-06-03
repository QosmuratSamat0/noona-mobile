package http

import (
	"context"
	"fmt"
	"net/http"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/render"
)

type MistakeMemoryUseCase interface {
	ListSummary(ctx context.Context, userID string) (*learning.MemorySummary, error)
}

type VocabularyUseCase interface {
	GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error)
}

type AnalysisUseCase interface {
	GetMine(ctx context.Context, userID string) (*learning.AnalysisSummary, error)
}

type InsightsHandler struct {
	memory     MistakeMemoryUseCase
	vocabulary VocabularyUseCase
	analysis   AnalysisUseCase
}

func NewInsightsHandler(memory MistakeMemoryUseCase, vocabulary VocabularyUseCase, analysis AnalysisUseCase) *InsightsHandler {
	return &InsightsHandler{memory: memory, vocabulary: vocabulary, analysis: analysis}
}

type MistakeMemoryResponse struct {
	TopMistakes []MistakeMemoryItem `json:"top_mistakes"`
	Improving   []MistakeMemoryItem `json:"improving"`
	Fixed       []MistakeMemoryItem `json:"fixed"`
}

type MistakeMemoryItem struct {
	PatternKey  string `json:"pattern_key"`
	Title       string `json:"title"`
	TotalCount  int    `json:"total_count"`
	RecentCount int    `json:"recent_count"`
	Status      string `json:"status"`
	LastWrong   string `json:"last_wrong"`
	LastCorrect string `json:"last_correct"`
	Message     string `json:"message"`
}

func (h *InsightsHandler) MistakeMemory(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	summary, err := h.memory.ListSummary(r.Context(), user.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, MistakeMemoryResponse{
		TopMistakes: memoryItems(summary.TopMistakes),
		Improving:   memoryItems(summary.Improving),
		Fixed:       memoryItems(summary.Fixed),
	})
}

func (h *InsightsHandler) VocabularyToday(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	stats, err := h.vocabulary.GetToday(r.Context(), user.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, stats)
}

func (h *InsightsHandler) AnalysisMe(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	summary, err := h.analysis.GetMine(r.Context(), user.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, summary)
}

func memoryItems(memories []learning.MistakeMemory) []MistakeMemoryItem {
	items := make([]MistakeMemoryItem, 0, len(memories))
	for _, memory := range memories {
		items = append(items, MistakeMemoryItem{
			PatternKey:  memory.PatternKey,
			Title:       memory.Title,
			TotalCount:  memory.TotalCount,
			RecentCount: memory.RecentCount,
			Status:      memory.Status,
			LastWrong:   memory.LastOriginalText,
			LastCorrect: memory.LastCorrectedText,
			Message:     fmt.Sprintf("You often repeat %s.", memory.Title),
		})
	}
	return items
}
