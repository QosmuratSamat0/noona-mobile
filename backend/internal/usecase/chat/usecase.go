package chat

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
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

func (uc *UseCase) SaveMessage(ctx context.Context, userID string, sessionID string, role domain.Role, content string) (*domain.Message, error) {
	session, err := uc.chatRepo.GetSession(ctx, sessionID)
	if err != nil {
		return nil, errs.ErrSessionNotFound
	}

	if session.UserID != userID {
		return nil, errs.ErrSessionAccessDenied
	}

	msg := &domain.Message{
		SessionID: sessionID,
		Role:      role,
		Content:   content,
	}

	err = uc.chatRepo.SaveMessage(ctx, msg)
	if err != nil {
		return nil, err
	}

	return msg, nil
}

func (uc *UseCase) GetSessionMessages(ctx context.Context, userID string, sessionID string) ([]*domain.Message, error) {
	session, err := uc.chatRepo.GetSession(ctx, sessionID)
	if err != nil {
		return nil, errs.ErrSessionNotFound
	}

	if session.UserID != userID {
		return nil, errs.ErrSessionAccessDenied
	}

	return uc.chatRepo.GetSessionMessages(ctx, sessionID)
}
