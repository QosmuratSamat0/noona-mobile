package chat

import (
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type Role string

const (
	RoleUser Role = "user"
	RoleAI   Role = "ai"
)

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Message struct {
	ID        string                    `json:"id"`
	SessionID string                    `json:"session_id"`
	Role      Role                      `json:"role"`
	Content   string                    `json:"content"`
	AudioURL  string                    `json:"audio_url,omitempty"`
	Feedback  *linguistic.QuickFeedback `json:"feedback,omitempty"`
	CreatedAt time.Time                 `json:"created_at"`
}
