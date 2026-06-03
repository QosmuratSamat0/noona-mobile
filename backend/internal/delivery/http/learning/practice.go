package http

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/practice"
	"github.com/go-chi/render"
)

type PracticeUseCase interface {
	SubmitText(ctx context.Context, input practice.TextInput) (*learning.ResultView, error)
	SubmitAudio(ctx context.Context, input practice.AudioInput) (*learning.ResultView, error)
}

type PracticeHandler struct {
	uc PracticeUseCase
}

func NewPracticeHandler(uc PracticeUseCase) *PracticeHandler {
	return &PracticeHandler{uc: uc}
}

type PracticeTextRequest struct {
	Text           string `json:"text"`
	DailySessionID string `json:"daily_session_id"`
}

func (h *PracticeHandler) SubmitText(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	var req PracticeTextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request"))
		return
	}
	view, err := h.uc.SubmitText(r.Context(), practice.TextInput{
		UserID:         user.ID,
		Text:           req.Text,
		DailySessionID: req.DailySessionID,
	})
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error(err.Error()))
		return
	}
	render.JSON(w, r, toResultResponse(view))
}

func (h *PracticeHandler) SubmitAudio(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("failed to parse form data"))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("file is required"))
		return
	}
	defer file.Close()

	view, err := h.uc.SubmitAudio(r.Context(), practice.AudioInput{
		UserID:         user.ID,
		File:           file,
		FileSize:       header.Size,
		ContentType:    header.Header.Get("Content-Type"),
		Ext:            filepath.Ext(header.Filename),
		DailySessionID: r.FormValue("daily_session_id"),
	})
	if err != nil {
		status := http.StatusBadRequest
		if err == io.ErrUnexpectedEOF {
			status = http.StatusInternalServerError
		}
		render.Status(r, status)
		render.JSON(w, r, resp.Error(err.Error()))
		return
	}
	render.JSON(w, r, toResultResponse(view))
}
