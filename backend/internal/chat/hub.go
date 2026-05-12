package chat

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
)

type Message struct {
	UserID string `json:"user_id"`
	Type   string `json:"type"`
	Data   any    `json:"data"`
}

type Hub struct {
	mu      sync.RWMutex
	clients map[string]chan []byte
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]chan []byte),
	}
}

func (h *Hub) Register(userID string) chan []byte {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Close old channel if user connects from another device
	if oldCh, ok := h.clients[userID]; ok {
		close(oldCh)
	}

	ch := make(chan []byte, 256)
	h.clients[userID] = ch
	return ch
}

func (h *Hub) Unregister(userID string, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if currentCh, ok := h.clients[userID]; ok && currentCh == ch {
		close(ch)
		delete(h.clients, userID)
	}
}

func (h *Hub) SendToUser(userID string, msg Message) {
	msg.UserID = userID

	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("failed to marshal message", "error", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	ch, ok := h.clients[userID]
	if !ok {
		slog.Warn("user not connected to ws", "user_id", userID)
		return
	}

	select {
	case ch <- data:
	default:
		slog.Warn("channel full, dropping message", "user_id", userID)
	}
}

func (h *Hub) PushToUser(ctx context.Context, userID string, payload any) error {
	msg := Message{
		UserID: userID,
	}

	if m, ok := payload.(map[string]any); ok {
		if t, ok := m["type"].(string); ok {
			msg.Type = t
		}
		if d, ok := m["data"]; ok {
			msg.Data = d
		} else {
			msg.Data = payload
		}
	} else {
		msg.Data = payload
	}

	h.SendToUser(userID, msg)
	return nil
}
