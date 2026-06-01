package http

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	model "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	userUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/user"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type UserUseCase interface {
	CreateUser(ctx context.Context, requester *model.User, input userUseCase.CreateUserInput) error
	GetAllUsers(ctx context.Context, requester *model.User) ([]*model.User, error)
	GetUserByID(ctx context.Context, requester *model.User, id string) (*model.User, error)
	UpdateUser(ctx context.Context, requester *model.User, input userUseCase.UpdateUserInput) error
	DeleteUser(ctx context.Context, requester *model.User, id string) error
}

type UserHandler struct {
	userUC UserUseCase
}

type CreateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type UpdateUserRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Role           string `json:"role"`
	CEFRLevel      string `json:"cefr_level"`
	NativeLanguage string `json:"native_language"`
}

type UserResponse struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	Role           string `json:"role"`
	CEFRLevel      string `json:"cefr_level"`
	NativeLanguage string `json:"native_language"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

func NewUserHandler(userUC UserUseCase) *UserHandler {
	return &UserHandler{
		userUC: userUC,
	}
}

// GetMe godoc
// @Summary Get current user profile
// @Description Get profile of the authenticated user
// @Tags users
// @Accept  json
// @Produce  json
// @Success 200 {object} UserResponse
// @Failure 401 {object} response.Response
// $Failure 403 {object} response.Response
// @Failure 404 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /users/me [get]
func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	const op = "UserHandler.GetMe"
	log := slog.With("operation", op)
	requester, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		log.Info("failed to get user from context")
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	user, err := h.userUC.GetUserByID(
		r.Context(),
		requester,
		requester.ID,
	)
	if err != nil {
		log.Info("failed to get user", "error", err)
		if errors.Is(err, errs.ErrUserNotFound) {
			render.Status(r, http.StatusNotFound)
			render.JSON(w, r, resp.Error("user not found"))
			return
		}
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("failed to get user"))
		return
	}

	render.JSON(w, r, toUserResponse(user))
}

// CreateUser godoc
// @Summary Create a new user (Admin only)
// @Description Create a new user with specific role
// @Tags users
// @Accept  json
// @Produce  json
// @Param   input  body      CreateUserRequest  true  "User info"
// @Success 201 {object} response.Response
// @Failure 403 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /users [post]
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	const op = "UserHandler.CreateUser"
	log := slog.With("operation", op)

	requester, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Info("invalid request body", "error", err)

		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request"))
		return
	}

	if req.Email == "" || req.Password == "" {
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid input"))
		return
	}

	err := h.userUC.CreateUser(r.Context(), requester, userUseCase.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Role:     model.Role(req.Role),
	})

	if err != nil {
		log.Info("failed to create user", "error", err)
		if errors.Is(err, errs.ErrForbidden) {
			render.Status(r, http.StatusForbidden)
			render.JSON(w, r, resp.Error("forbidden"))
			return
		}
		if errors.Is(err, errs.ErrEmailAlreadyExists) {
			render.Status(r, http.StatusBadRequest)
			render.JSON(w, r, resp.Error("email already exists"))
			return
		}
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("failed to create user"))
		return
	}
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, resp.OK())
}

// GetUserByID godoc
// @Summary Get user by ID
// @Description Get user details by their UUID
// @Tags users
// @Accept  json
// @Produce  json
// @Param   id   path      string  true  "User ID"
// @Success 200 {object} UserResponse
// @Failure 404 {object} response.Response
// @Failure 403 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /users/{id} [get]
func (h *UserHandler) GetUserByID(w http.ResponseWriter, r *http.Request) {
	const op = "UserHandler.GetUserByID"
	log := slog.With("operation", op)

	requester, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	id := chi.URLParam(r, "id")

	user, err := h.userUC.GetUserByID(r.Context(), requester, id)
	if err != nil {
		log.Info("failed to get user", "error", err)
		handleUserError(w, r, err)
		return
	}

	render.JSON(w, r, toUserResponse(user))
}

// GetAllUsers godoc
// @Summary Get all users
// @Description Get a list of all users
// @Tags users
// @Accept  json
// @Produce  json
// @Success 200 {array} UserResponse
// @Failure 403 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 404 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /users [get]
func (h *UserHandler) GetAllUsers(w http.ResponseWriter, r *http.Request) {
	const op = "UserHandler.GetAllUsers"
	log := slog.With("operation", op)

	requester, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	users, err := h.userUC.GetAllUsers(r.Context(), requester)
	if err != nil {
		log.Info("failed to get all users", "error", err)
		if errors.Is(err, errs.ErrUnauthorized) {
			render.Status(r, http.StatusUnauthorized)
			render.JSON(w, r, resp.Error("unauthorized"))
			return
		}
		if errors.Is(err, errs.ErrForbidden) {
			render.Status(r, http.StatusForbidden)
			render.JSON(w, r, resp.Error("forbidden"))
			return
		}
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("failed to get all users"))
		return
	}

	res := make([]UserResponse, 0, len(users))
	for _, user := range users {
		res = append(res, toUserResponse(user))
	}
	render.JSON(w, r, res)
}

// UpdateUser godoc
// @Summary Update user
// @Description Update user details
// @Tags users
// @Accept  json
// @Produce  json
// @Param   id     path      string             true  "User ID"
// @Param   input  body      UpdateUserRequest  true  "User update info"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 403 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /users/{id} [put]
func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	const op = "UserHandler.UpdateUser"
	log := slog.With("operation", op)

	requester, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	id := chi.URLParam(r, "id")

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Info("invalid request body", "error", err)
		render.Status(r, http.StatusBadRequest)
		render.JSON(w, r, resp.Error("invalid request"))
		return
	}

	err := h.userUC.UpdateUser(
		r.Context(),
		requester,
		userUseCase.UpdateUserInput{
			ID:             id,
			Name:           req.Name,
			Email:          req.Email,
			Role:           model.Role(req.Role),
			CEFRLevel:      req.CEFRLevel,
			NativeLanguage: req.NativeLanguage,
		},
	)

	if err != nil {
		log.Info("failed to update user", "error", err)
		handleUserError(w, r, err)
		return
	}

	render.JSON(w, r, resp.OK())
}

func toUserResponse(user *model.User) UserResponse {
	return UserResponse{
		ID:             user.ID,
		Name:           user.Username,
		Email:          user.Email,
		Role:           string(user.Role),
		CEFRLevel:      user.CEFRLevel,
		NativeLanguage: user.NativeLanguage,
		CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:      user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// DeleteUser godoc
// @Summary Delete user
// @Description Delete a user by ID
// @Tags users
// @Accept  json
// @Produce  json
// @Param   id   path      string  true  "User ID"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 403 {object} response.Response
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Security BearerAuth
// @Router /users/{id} [delete]
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	const op = "UserHandler.DeleteUser"
	log := slog.With("operation", op)

	requester, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
		return
	}

	id := chi.URLParam(r, "id")

	err := h.userUC.DeleteUser(r.Context(), requester, id)
	if err != nil {
		log.Info("failed to delete user", "error", err)
		handleUserError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func handleUserError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, errs.ErrUserNotFound):
		render.Status(r, http.StatusNotFound)
		render.JSON(w, r, resp.Error("user not found"))
	case errors.Is(err, errs.ErrUnauthorized):
		render.Status(r, http.StatusUnauthorized)
		render.JSON(w, r, resp.Error("unauthorized"))
	case errors.Is(err, errs.ErrForbidden):
		render.Status(r, http.StatusForbidden)
		render.JSON(w, r, resp.Error("forbidden"))
	default:
		render.Status(r, http.StatusInternalServerError)
		render.JSON(w, r, resp.Error("internal error"))
	}
}
