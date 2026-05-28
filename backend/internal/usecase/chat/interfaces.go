package chat

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
)

type ChatRepo interface {
	CreateSession(ctx context.Context, userID string) (*domain.Session, error)
	GetSession(ctx context.Context, sessionID string) (*domain.Session, error)
	GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error)
	SaveMessage(ctx context.Context, msg *domain.Message) error
	GetSessionMessages(ctx context.Context, sessionID string) ([]*domain.Message, error)
}

type ActivityUseCase interface {
	RecordActivity(ctx context.Context, userID string) error
}

type LLMProvider interface {
	StreamReply(ctx context.Context, transcript string) (<-chan string, error)
}

type TTSService interface {
	GenerateAudio(ctx context.Context, text string) (string, error)
}
