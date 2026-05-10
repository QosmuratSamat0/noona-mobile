package http

import (
	"github.com/go-chi/chi/v5"
)

type AuthModule struct {
	authHandler *AuthHandler
}

func NewAuthModule(authUC AuthUseCase) *AuthModule {
	return &AuthModule{
		authHandler: NewAuthHandler(authUC),
	}
}

func (m *AuthModule) RegisterRoutes(r chi.Router) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", m.authHandler.Register)
	})
}
