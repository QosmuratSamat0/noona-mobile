package http

import (
	"context"
	"net/http"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type DailyUseCase interface {
	Start(ctx context.Context, userID string) (*learning.DailySession, error)
	Finish(ctx context.Context, userID, sessionID string) (*learning.DailySession, error)
	Today(ctx context.Context, userID string) (*learning.DailySession, error)
	ByDate(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error)
}

type DailyHandler struct {
	uc DailyUseCase
}

func NewDailyHandler(uc DailyUseCase) *DailyHandler {
	return &DailyHandler{uc: uc}
}

func (h *DailyHandler) Start(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	session, err := h.uc.Start(r.Context(), user.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, toDailyResponse(session))
}

func (h *DailyHandler) Finish(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	session, err := h.uc.Finish(r.Context(), user.ID, chi.URLParam(r, "id"))
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	if session == nil {
		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, resp.Error("session not found"))
		return
	}
	render.JSON(w, r, toDailyResponse(session))
}

func (h *DailyHandler) Today(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	session, err := h.uc.Today(r.Context(), user.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, toDailyResponse(session))
}

func (h *DailyHandler) ByDate(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	dateValue := r.URL.Query().Get("date")
	if dateValue == "" {
		dateValue = time.Now().Format("2006-01-02")
	}
	date, err := time.Parse("2006-01-02", dateValue)
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("date must be YYYY-MM-DD"))
		return
	}
	session, err := h.uc.ByDate(r.Context(), user.ID, date)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, toDailyResponse(session))
}
