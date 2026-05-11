package http

import (
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/go-chi/chi/v5"
)

type ActivityModule struct {
	handler *ActivityHandler
}

func NewActivityModule(uc ActivityUseCase) *ActivityModule {
	return &ActivityModule{
		handler: NewActivityHandler(uc),
	}
}

func (m *ActivityModule) RegisterRoutes(r chi.Router, secret string) {
	r.Route("/activity", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(secret))

		r.Get("/me", m.handler.GetMyActivity)
	})
}
