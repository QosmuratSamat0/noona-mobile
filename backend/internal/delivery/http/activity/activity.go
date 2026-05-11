package http

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/render"
)

type ActivityUseCase interface {
	GetActivity(ctx context.Context, userID string) (*domain.Streak, []*domain.DailyStat, error)
}

type ActivityHandler struct {
	uc ActivityUseCase
}

func NewActivityHandler(uc ActivityUseCase) *ActivityHandler {
	return &ActivityHandler{uc: uc}
}

type StreakResponse struct {
	CurrentStreak    int        `json:"current_streak"`
	LongestStreak    int        `json:"longest_streak"`
	LastActivityDate *time.Time `json:"last_activity_date"`
}

type DailyStatResponse struct {
	Date         time.Time `json:"date"`
	SessionCount int       `json:"session_count"`
}

type ActivityResponse struct {
	Streak     StreakResponse      `json:"streak"`
	DailyStats []DailyStatResponse `json:"daily_stats"`
}

// GetMyActivity godoc
// @Summary Get user activity stats and streak
// @Description Returns the current streak and daily activity history
// @Tags activity
// @Accept  json
// @Produce  json
// @Success 200 {object} ActivityResponse
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /activity/me [get]
func (h *ActivityHandler) GetMyActivity(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	streak, stats, err := h.uc.GetActivity(r.Context(), user.ID)
	if err != nil {
		slog.Error("failed to get activity", "error", err)
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	var statsRes []DailyStatResponse
	for _, s := range stats {
		statsRes = append(statsRes, DailyStatResponse{
			Date:         s.Date,
			SessionCount: s.SessionCount,
		})
	}

	render.JSON(w, r, ActivityResponse{
		Streak: StreakResponse{
			CurrentStreak:    streak.CurrentStreak,
			LongestStreak:    streak.LongestStreak,
			LastActivityDate: streak.LastActivityDate,
		},
		DailyStats: statsRes,
	})
}
