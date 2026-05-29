package chat

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
)

type UseCase struct {
	chatRepo   ChatRepo
	userRepo   UserRepo
	activityUC ActivityUseCase
	linguistic LinguisticUseCase
	llm        LLMProvider
	tts        TTSService
}

type SendMessageResult struct {
	Reply    *domain.Message
	Feedback *linguistic.QuickFeedback
}

func NewUseCase(chatRepo ChatRepo, activityUC ActivityUseCase, args ...any) *UseCase {
	uc := &UseCase{
		chatRepo:   chatRepo,
		activityUC: activityUC,
	}
	for _, arg := range args {
		switch v := arg.(type) {
		case LLMProvider:
			uc.llm = v
		case UserRepo:
			uc.userRepo = v
		case LinguisticUseCase:
			uc.linguistic = v
		}
	}
	return uc
}

func (uc *UseCase) WithTTS(tts TTSService) *UseCase {
	uc.tts = tts
	return uc
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

func (uc *UseCase) SendMessageWithReply(ctx context.Context, userID string, sessionID string, content string) (*SendMessageResult, error) {
	userMessage, err := uc.SaveMessage(ctx, userID, sessionID, domain.RoleUser, content)
	if err != nil {
		return nil, err
	}

	var feedback *linguistic.QuickFeedback
	reply := uc.fallbackReply(content)
	if uc.llm != nil {
		feedbackCtx, cancelFeedback := context.WithTimeout(ctx, 6*time.Second)
		feedbackResult, err := uc.llm.QuickFeedback(feedbackCtx, strings.TrimSpace(content))
		cancelFeedback()
		if err != nil {
			slog.Warn("chat quick grammar failed", "error", err)
		} else {
			feedback = feedbackResult
			uc.saveFeedback(ctx, userID, userMessage, feedback)
		}

		replyCtx, cancelReply := context.WithTimeout(ctx, 8*time.Second)
		replyChan, err := uc.llm.StreamReply(replyCtx, strings.TrimSpace(content), uc.userCEFRLevel(ctx, userID))
		if err != nil {
			slog.Warn("chat llm reply failed, using fallback", "error", err)
		} else {
			var builder strings.Builder
			for chunk := range replyChan {
				builder.WriteString(chunk)
			}
			if text := strings.TrimSpace(builder.String()); text != "" {
				reply = cleanCoachReply(text)
			}
		}
		cancelReply()
	}

	msg := &domain.Message{
		SessionID: sessionID,
		Role:      domain.RoleAI,
		Content:   reply,
	}
	if err := uc.chatRepo.SaveMessage(ctx, msg); err != nil {
		return nil, fmt.Errorf("save ai reply: %w", err)
	}

	return &SendMessageResult{Reply: msg, Feedback: feedback}, nil
}

func (uc *UseCase) saveFeedback(ctx context.Context, userID string, msg *domain.Message, feedback *linguistic.QuickFeedback) {
	if uc.linguistic == nil || msg == nil || feedback == nil {
		return
	}
	transcript, err := uc.linguistic.SaveTranscript(ctx, msg.ID, msg.Content)
	if err != nil {
		slog.Warn("chat grammar transcript save failed", "error", err, "message_id", msg.ID)
		return
	}
	if _, err := uc.linguistic.SaveCorrection(ctx, transcript.ID, feedback.CorrectedText, feedback.Reason, uc.userCEFRLevel(ctx, userID)); err != nil {
		slog.Warn("chat grammar correction save failed", "error", err, "message_id", msg.ID)
	}
}

func (uc *UseCase) userCEFRLevel(ctx context.Context, userID string) string {
	if uc.userRepo == nil {
		return "A1"
	}
	user, err := uc.userRepo.GetUserByID(ctx, userID)
	if err != nil || user == nil || strings.TrimSpace(user.CEFRLevel) == "" {
		return "A1"
	}
	return strings.ToUpper(strings.TrimSpace(user.CEFRLevel))
}

func cleanCoachReply(text string) string {
	replacer := strings.NewReplacer(
		"**", "",
		"* ", "",
		"*", "",
		"😊", "",
		"🙂", "",
		"😄", "",
		"😀", "",
	)
	return strings.TrimSpace(replacer.Replace(text))
}

func (uc *UseCase) fallbackReply(content string) string {
	text := strings.ToLower(strings.TrimSpace(content))
	switch text {
	case "hi", "hello", "hey":
		return "Hey! I am Noona. Say one short sentence in English, and I will help you improve it."
	default:
		return "I hear you. Try saying a full English sentence, and I will correct it."
	}
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
