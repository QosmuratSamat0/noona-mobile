package chat

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
)

type UseCase struct {
	chatRepo ChatRepo
}

func NewUseCase(chatRepo ChatRepo) *UseCase {
	return &UseCase{
		chatRepo: chatRepo,
	}
}

func (uc *UseCase) CreateSession(ctx context.Context, userID string) (*domain.Session, error) {
	return uc.chatRepo.CreateSession(ctx, userID)
}

func (uc *UseCase) GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error) {
	return uc.chatRepo.GetUserSessions(ctx, userID)
}

func (uc *UseCase) SaveMessage(ctx context.Context, sessionID string, role domain.Role, content string) (*domain.Message, error) {
	msg := &domain.Message{
		SessionID: sessionID,
		Role:      role,
		Content:   content,
	}

	err := uc.chatRepo.SaveMessage(ctx, msg)
	if err != nil {
		return nil, err
	}

	return msg, nil
}

func (uc *UseCase) GetSessionMessages(ctx context.Context, sessionID string) ([]*domain.Message, error) {
	return uc.chatRepo.GetSessionMessages(ctx, sessionID)
}
