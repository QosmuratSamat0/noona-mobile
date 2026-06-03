package http

import (
	"context"
	"net/http"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type ResultsUseCase interface {
	Get(ctx context.Context, userID, resultID string) (*learning.ResultView, error)
	List(ctx context.Context, userID, sessionID string) ([]learning.Result, error)
}

type ResultsHandler struct {
	uc ResultsUseCase
}

func NewResultsHandler(uc ResultsUseCase) *ResultsHandler {
	return &ResultsHandler{uc: uc}
}

func (h *ResultsHandler) Get(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	view, err := h.uc.Get(r.Context(), user.ID, chi.URLParam(r, "id"))
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	if view == nil {
		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, resp.Error("result not found"))
		return
	}
	render.JSON(w, r, toResultResponse(view))
}

func (h *ResultsHandler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	results, err := h.uc.List(r.Context(), user.ID, r.URL.Query().Get("session_id"))
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}
	render.JSON(w, r, results)
}
