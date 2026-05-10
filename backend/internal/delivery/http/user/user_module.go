package http

import (
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/go-chi/chi/v5"
)

type UserModule struct {
	UserHandler *UserHandler
}

func NewUserModule(userUC UserUseCase) *UserModule {
	return &UserModule{
		UserHandler: NewUserHandler(userUC),
	}
}

func (m *UserModule) RegisterRoutes(r chi.Router, secret string) {
	r.Route("/users", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(secret))

		r.Get("/me", m.UserHandler.GetMe)
		r.Post("/", m.UserHandler.CreateUser)
		r.Get("/", m.UserHandler.GetAllUsers)
		r.Get("/{id}", m.UserHandler.GetUserByID)
		r.Put("/{id}", m.UserHandler.UpdateUser)
		r.Delete("/{id}", m.UserHandler.DeleteUser)
	})
}
