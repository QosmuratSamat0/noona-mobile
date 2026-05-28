package http

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type ChatUseCase interface {
	CreateSession(ctx context.Context, userID string) (*domain.Session, error)
	GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error)
	SaveMessage(ctx context.Context, userID string, sessionID string, role domain.Role, content string) (*domain.Message, error)
	SendMessageWithReply(ctx context.Context, userID string, sessionID string, content string) (*domain.Message, error)
	GetSessionMessages(ctx context.Context, userID string, sessionID string) ([]*domain.Message, error)
}

type ChatHandler struct {
	chatUC ChatUseCase
}

func NewChatHandler(chatUC ChatUseCase) *ChatHandler {
	return &ChatHandler{
		chatUC: chatUC,
	}
}

type SessionResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type MessageResponse struct {
	ID        string    `json:"id"`
	SessionID string    `json:"session_id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	AudioURL  string    `json:"audio_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateSession godoc
// @Summary Create a new chat session
// @Description Start a new chat session for the authenticated user
// @Tags chat
// @Accept  json
// @Produce  json
// @Success 201 {object} SessionResponse
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /sessions [post]
func (h *ChatHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	session, err := h.chatUC.CreateSession(r.Context(), user.ID)
	if err != nil {
		slog.Error("failed to create session", "error", err)
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, SessionResponse{
		ID:        session.ID,
		UserID:    session.UserID,
		CreatedAt: session.CreatedAt,
	})
}

// GetUserSessions godoc
// @Summary Get user's chat sessions
// @Description List all chat sessions for the authenticated user
// @Tags chat
// @Accept  json
// @Produce  json
// @Success 200 {array} SessionResponse
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /sessions [get]
func (h *ChatHandler) GetUserSessions(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	sessions, err := h.chatUC.GetUserSessions(r.Context(), user.ID)
	if err != nil {
		slog.Error("failed to get sessions", "error", err)
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	var res []SessionResponse
	for _, s := range sessions {
		res = append(res, SessionResponse{
			ID:        s.ID,
			UserID:    s.UserID,
			CreatedAt: s.CreatedAt,
		})
	}

	render.JSON(w, r, res)
}

// GetSessionMessages godoc
// @Summary Get messages in a session
// @Description List all messages for a specific chat session
// @Tags chat
// @Accept  json
// @Produce  json
// @Param   sessionID  path      string  true  "Session ID"
// @Success 200 {array} MessageResponse
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /sessions/{sessionID}/messages [get]
func (h *ChatHandler) GetSessionMessages(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	sessionID := chi.URLParam(r, "sessionID")
	if sessionID == "" {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid session id"))
		return
	}

	messages, err := h.chatUC.GetSessionMessages(r.Context(), user.ID, sessionID)
	if err != nil {
		if errors.Is(err, errs.ErrSessionAccessDenied) {
			render.Status(r, http.StatusForbidden)
			render.JSON(w, r, resp.Error("access denied"))
			return
		}
		if errors.Is(err, errs.ErrSessionNotFound) {
			render.Status(r, http.StatusNotFound)
			render.JSON(w, r, resp.Error("session not found"))
			return
		}
		slog.Error("failed to get messages", "error", err)
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	var res []MessageResponse
	for _, m := range messages {
		res = append(res, MessageResponse{
			ID:        m.ID,
			SessionID: m.SessionID,
			Role:      string(m.Role),
			Content:   m.Content,
			AudioURL:  m.AudioURL,
			CreatedAt: m.CreatedAt,
		})
	}

	render.JSON(w, r, res)
}

type SendMessageRequest struct {
	Content string `json:"content"`
}

// SendMessage godoc
// @Summary Send a message to a session
// @Description Send a new user message to a specific chat session
// @Tags chat
// @Accept  json
// @Produce  json
// @Param   sessionID  path      string              true  "Session ID"
// @Param   input      body      SendMessageRequest  true  "Message content"
// @Success 201 {object} MessageResponse
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /sessions/{sessionID}/messages [post]
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	sessionID := chi.URLParam(r, "sessionID")
	if sessionID == "" {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid session id"))
		return
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request body"))
		return
	}

	msg, err := h.chatUC.SendMessageWithReply(r.Context(), user.ID, sessionID, req.Content)
	if err != nil {
		if errors.Is(err, errs.ErrSessionAccessDenied) {
			render.Status(r, http.StatusForbidden)
			render.JSON(w, r, resp.Error("access denied"))
			return
		}
		if errors.Is(err, errs.ErrSessionNotFound) {
			render.Status(r, http.StatusNotFound)
			render.JSON(w, r, resp.Error("session not found"))
			return
		}
		slog.Error("failed to save message", "error", err)
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
		return
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, MessageResponse{
		ID:        msg.ID,
		SessionID: msg.SessionID,
		Role:      string(msg.Role),
		Content:   msg.Content,
		AudioURL:  msg.AudioURL,
		CreatedAt: msg.CreatedAt,
	})
}
