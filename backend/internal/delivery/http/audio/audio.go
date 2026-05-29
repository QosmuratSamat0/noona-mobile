package http

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/render"
)

type AudioUseCase interface {
	UploadAudio(ctx context.Context, userID, sessionID string, file io.Reader, fileSize int64, contentType, ext string) (string, error)
}

type AudioHandler struct {
	audioUC AudioUseCase
}

func NewAudioHandler(audioUC AudioUseCase) *AudioHandler {
	return &AudioHandler{
		audioUC: audioUC,
	}
}

type UploadResponse struct {
	JobID string `json:"job_id"`
}

// Upload godoc
// @Summary Upload audio file
// @Description Upload audio file, save to MinIO and create job
// @Tags audio
// @Accept mpfd
// @Produce json
// @Param file formData file true "Audio file"
// @Success 200 {object} UploadResponse
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 429 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /audio/upload [post]
// @Security BearerAuth
func (h *AudioHandler) Upload(w http.ResponseWriter, r *http.Request) {
	const op = "AudioHandler.Upload"
	log := slog.With("operation", op)

	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		log.Error("unauthorized")
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	err := r.ParseMultipartForm(32 << 20) // 32 MB max memory
	if err != nil {
		log.Error("failed to parse multipart form", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("failed to parse form data"))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Error("failed to get file from form", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("file is required"))
		return
	}
	defer file.Close()

	ext := filepath.Ext(header.Filename)
	contentType := header.Header.Get("Content-Type")
	sessionID := r.FormValue("session_id")

	jobID, err := h.audioUC.UploadAudio(r.Context(), user.ID, sessionID, file, header.Size, contentType, ext)
	if err != nil {
		log.Error("failed to upload audio", "error", err)
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal server error"))
		return
	}

	render.JSON(w, r, UploadResponse{
		JobID: jobID,
	})
}
