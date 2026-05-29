package http

import (
	"log/slog"
	"net/http"
	"net/url"
	"time"

	wsHub "github.com/QosmuratSamat0/Noona-AI/backend/internal/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/middleware"
	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}

		u, err := url.Parse(origin)
		if err != nil {
			return false
		}

		if u.Host == r.Host {
			return true
		}

		if u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" {
			return true
		}

		// In a production environment, this should validate against a config-driven allowlist.
		return false
	},
}

type WSHandler struct {
	hub *wsHub.Hub
}

func NewWSHandler(hub *wsHub.Hub) *WSHandler {
	return &WSHandler{
		hub: hub,
	}
}

// HandleWS godoc
// @Summary Connect to websocket
// @Description Connect to websocket for chat and notifications
// @Tags chat
// @Router /ws/chat [get]
// @Security BearerAuth
func (h *WSHandler) HandleWS(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUserFromContext(r.Context())
	if !ok {
		slog.Error("unauthorized ws connection")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("failed to upgrade to websocket", "error", err)
		return
	}

	ch := h.hub.Register(user.ID)

	go writePump(conn, ch)
	go readPump(conn, h.hub, user.ID, ch)
}

func readPump(conn *websocket.Conn, hub *wsHub.Hub, userID string, ch chan []byte) {
	defer func() {
		hub.Unregister(userID, ch)
		conn.Close()
	}()

	conn.SetReadLimit(512)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error { conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(
				err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
				websocket.CloseNoStatusReceived,
				websocket.CloseNormalClosure,
			) {
				slog.Error("websocket error", "error", err)
			}
			break
		}
		// We only expect server->client messages or basic pings right now
	}
}

func writePump(conn *websocket.Conn, ch chan []byte) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case message, ok := <-ch:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.WriteMessage(
					websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
				)
				return
			}

			w, err := conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message.
			n := len(ch)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-ch)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
