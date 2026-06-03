package http

import (
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/go-chi/chi/v5"
)

type LinguisticModule struct {
	handler *LinguisticHandler
}

func NewLinguisticModule(uc LinguisticUseCase) *LinguisticModule {
	return &LinguisticModule{
		handler: NewLinguisticHandler(uc),
	}
}

func (m *LinguisticModule) RegisterRoutes(r chi.Router, secret string) {
	r.Route("/linguistic", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(secret))

		r.Post("/translate", m.handler.Translate)
	})
}
