package http

import (
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	wsHub "github.com/QosmuratSamat0/Noona-AI/backend/internal/chat"
	"github.com/go-chi/chi/v5"
)

type ChatModule struct {
	chatHandler *ChatHandler
	wsHandler   *WSHandler
}

func NewChatModule(chatUC ChatUseCase, hub *wsHub.Hub) *ChatModule {
	return &ChatModule{
		chatHandler: NewChatHandler(chatUC),
		wsHandler:   NewWSHandler(hub),
	}
}

func (m *ChatModule) RegisterRoutes(r chi.Router, secret string) {
	r.Route("/sessions", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(secret))

		r.Post("/", m.chatHandler.CreateSession)
		r.Get("/", m.chatHandler.GetUserSessions)

		r.Route("/{sessionID}", func(r chi.Router) {
			r.Get("/messages", m.chatHandler.GetSessionMessages)
			r.Post("/messages", m.chatHandler.SendMessage)
		})
	})
	
	r.Route("/ws", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(secret))
		r.Get("/chat", m.wsHandler.HandleWS)
	})
}
