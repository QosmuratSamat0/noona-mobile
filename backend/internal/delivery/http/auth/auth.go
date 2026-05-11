package http

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
	"github.com/go-chi/render"
)

type AuthUseCase interface {
	Register(ctx context.Context, input authUseCase.RegisterInput) error
	Login(ctx context.Context, input authUseCase.LoginInput) (*authUseCase.AuthTokens, error)
	Refresh(ctx context.Context, refreshToken string) (*authUseCase.AuthTokens, error)
	Logout(ctx context.Context, refreshToken string) error
}

type AuthHandler struct {
	authUC AuthUseCase
}

type RegisterRequest struct {
	Username string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthTokensResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func NewAuthHandler(authUC AuthUseCase) *AuthHandler {
	return &AuthHandler{
		authUC: authUC,
	}
}

// Register godoc
// @Summary Register a new user
// @Description Register a new user with name, email and password
// @Tags auth
// @Accept  json
// @Produce  json
// @Param   input  body      RegisterRequest  true  "Registration info"
// @Success 201 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 409 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /auth/register [post]
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	const op = "AuthHandler.Register"
	log := slog.With("operation", op)

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("failed to decode request body", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request body"))
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("all fields required"))
		return
	}

	err := h.authUC.Register(r.Context(), authUseCase.RegisterInput{
		Username: req.Username,
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		log.Error("failed to register user", "error", err)
		handleAuthError(w, r, err)
		return
	}
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, resp.OK())
}

// Login godoc
// @Summary Login user
// @Description Login with email and password to get tokens
// @Tags auth
// @Accept  json
// @Produce  json
// @Param   input  body      LoginRequest  true  "Login info"
// @Success 200 {object} AuthTokensResponse
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	const op = "AuthHandler.Login"
	log := slog.With("operation", op)

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("failed to decode request body", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request body"))
		return
	}

	tokens, err := h.authUC.Login(r.Context(), authUseCase.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		log.Error("failed to login", "error", err)
		handleAuthError(w, r, err)
		return
	}

	render.JSON(w, r, AuthTokensResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	})
}

// Refresh godoc
// @Summary Refresh tokens
// @Description Get new access and refresh tokens using a valid refresh token
// @Tags auth
// @Accept  json
// @Produce  json
// @Param   input  body      RefreshRequest  true  "Refresh info"
// @Success 200 {object} AuthTokensResponse
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /auth/refresh [post]
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	const op = "AuthHandler.Refresh"
	log := slog.With("operation", op)

	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("failed to decode request body", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request body"))
		return
	}

	tokens, err := h.authUC.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		log.Error("failed to refresh tokens", "error", err)
		handleAuthError(w, r, err)
		return
	}

	render.JSON(w, r, AuthTokensResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	})
}

// Logout godoc
// @Summary Logout user
// @Description Revoke a refresh token
// @Tags auth
// @Accept  json
// @Produce  json
// @Param   input  body      LogoutRequest  true  "Logout info"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /auth/logout [post]
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	const op = "AuthHandler.Logout"
	log := slog.With("operation", op)

	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error("failed to decode request body", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request body"))
		return
	}

	err := h.authUC.Logout(r.Context(), req.RefreshToken)
	if err != nil {
		log.Error("failed to logout", "error", err)
		handleAuthError(w, r, err)
		return
	}

	render.JSON(w, r, resp.OK())
}

func handleAuthError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, errs.ErrInvalidInput):
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid input"))

	case errors.Is(err, errs.ErrAlreadyExists):
		render.Status(r, http.StatusConflict)
		render.JSON(w, r, resp.Error("email already exists"))

	case errors.Is(err, errs.ErrUnauthorized),
		errors.Is(err, errs.ErrInvalidCredentials):
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))

	default:
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
	}
}
