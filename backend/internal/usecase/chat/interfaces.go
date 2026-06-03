package chat

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
)

type ChatRepo interface {
	GetOrCreateDailySession(ctx context.Context, userID string) (*domain.Session, bool, error)
	GetSession(ctx context.Context, sessionID string) (*domain.Session, error)
	GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error)
	SaveMessage(ctx context.Context, msg *domain.Message) error
	GetSessionMessages(ctx context.Context, sessionID string) ([]*domain.Message, error)
}

type ActivityUseCase interface {
	RecordActivity(ctx context.Context, userID string) error
}

type UserRepo interface {
	GetUserByID(ctx context.Context, id string) (*userDomain.User, error)
}

type LLMProvider interface {
	StreamReply(ctx context.Context, transcript, cefrLevel string) (<-chan string, error)
	QuickFeedback(ctx context.Context, transcript string) (*linguistic.QuickFeedback, error)
}

type TTSService interface {
	GenerateAudio(ctx context.Context, text string) (string, error)
}
