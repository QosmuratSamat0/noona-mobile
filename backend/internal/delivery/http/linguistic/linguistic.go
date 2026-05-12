package http

import (
	"context"
	"net/http"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type LinguisticUseCase interface {
	SaveTranscript(ctx context.Context, messageID, rawText string) (*domain.Transcript, error)
	GetTranscript(ctx context.Context, messageID string) (*domain.Transcript, error)
	SaveCorrection(ctx context.Context, transcriptID, correctedText, explanation string) (*domain.Correction, error)
	GetCorrections(ctx context.Context, transcriptID string) ([]*domain.Correction, error)
	SaveMistake(ctx context.Context, userID, mistakeType, original, fixed string) (*domain.Mistake, error)
	GetUserMistakes(ctx context.Context, userID string) ([]*domain.Mistake, error)
}

type LinguisticHandler struct {
	uc LinguisticUseCase
}

func NewLinguisticHandler(uc LinguisticUseCase) *LinguisticHandler {
	return &LinguisticHandler{uc: uc}
}

type MistakeResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Original  string    `json:"original"`
	Fixed     string    `json:"fixed"`
	CreatedAt time.Time `json:"created_at"`
}

type CorrectionResponse struct {
	ID            string `json:"id"`
	TranscriptID  string `json:"transcript_id"`
	CorrectedText string `json:"corrected_text"`
	Explanation   string `json:"explanation"`
}

// GetUserMistakes godoc
// @Summary Get user mistakes
// @Description List all recorded mistakes for the authenticated user
// @Tags linguistic
// @Accept  json
// @Produce  json
// @Success 200 {array} MistakeResponse
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /linguistic/mistakes [get]
func (h *LinguisticHandler) GetUserMistakes(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	mistakes, err := h.uc.GetUserMistakes(r.Context(), user.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	var res []MistakeResponse
	for _, m := range mistakes {
		res = append(res, MistakeResponse{
			ID:        m.ID,
			UserID:    m.UserID,
			Type:      m.Type,
			Original:  m.Original,
			Fixed:     m.Fixed,
			CreatedAt: m.CreatedAt,
		})
	}

	render.JSON(w, r, res)
}

// GetCorrectionsByMessage godoc
// @Summary Get corrections for a message
// @Description Get all corrections related to a specific chat message
// @Tags linguistic
// @Accept  json
// @Produce  json
// @Param   messageID  path      string  true  "Message ID"
// @Success 200 {array} CorrectionResponse
// @Failure 401 {object} response.Response
// @Failure 404 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /linguistic/messages/{messageID}/corrections [get]
func (h *LinguisticHandler) GetCorrectionsByMessage(w http.ResponseWriter, r *http.Request) {
	messageID := chi.URLParam(r, "messageID")

	transcript, err := h.uc.GetTranscript(r.Context(), messageID)
	if err != nil {
		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, resp.Error("transcript not found"))
		return
	}

	corrections, err := h.uc.GetCorrections(r.Context(), transcript.ID)
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	var res []CorrectionResponse
	for _, c := range corrections {
		res = append(res, CorrectionResponse{
			ID:            c.ID,
			TranscriptID:  c.TranscriptID,
			CorrectedText: c.CorrectedText,
			Explanation:   c.Explanation,
		})
	}

	render.JSON(w, r, res)
}
