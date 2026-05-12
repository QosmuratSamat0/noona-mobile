package http

import (
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/go-chi/chi/v5"
)

type AudioModule struct {
	audioHandler *AudioHandler
}

func NewAudioModule(audioUC AudioUseCase) *AudioModule {
	return &AudioModule{
		audioHandler: NewAudioHandler(audioUC),
	}
}

func (m *AudioModule) RegisterRoutes(r chi.Router, jwtSecret string) {
	r.Route("/audio", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(jwtSecret))
		
		r.With(middleware.RateLimitMiddleware()).Post("/upload", m.audioHandler.Upload)
	})
}
