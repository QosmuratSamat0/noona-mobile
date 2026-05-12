package chat

import (
	"context"
	"log/slog"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
)

type UseCase struct {
	chatRepo   ChatRepo
	activityUC ActivityUseCase
}

func NewUseCase(chatRepo ChatRepo, activityUC ActivityUseCase) *UseCase {
	return &UseCase{
		chatRepo:   chatRepo,
		activityUC: activityUC,
	}
}

func (uc *UseCase) CreateSession(ctx context.Context, userID string) (*domain.Session, error) {
	session, err := uc.chatRepo.CreateSession(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Record activity
	if err := uc.activityUC.RecordActivity(ctx, userID); err != nil {
		slog.Error("failed to record activity on session creation", "error", err, "user_id", userID)
	}

	return session, nil
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
