package http

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/render"
)

type LinguisticUseCase interface {
	Translate(ctx context.Context, text, targetLang string) (string, error)
}

type LinguisticHandler struct {
	uc LinguisticUseCase
}

func NewLinguisticHandler(uc LinguisticUseCase) *LinguisticHandler {
	return &LinguisticHandler{uc: uc}
}

type TranslateRequest struct {
	Text       string `json:"text"`
	TargetLang string `json:"target_lang"`
}

type TranslateResponse struct {
	Translation string `json:"translation"`
}

func (h *LinguisticHandler) Translate(w http.ResponseWriter, r *http.Request) {
	if _, ok := middleware.GetUserFromContext(r.Context()); !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	var req TranslateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request"))
		return
	}

	translation, err := h.uc.Translate(r.Context(), req.Text, req.TargetLang)
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error(err.Error()))
		return
	}
	render.JSON(w, r, TranslateResponse{Translation: translation})
}
