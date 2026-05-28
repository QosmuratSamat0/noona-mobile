package chat

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
)

type UseCase struct {
	chatRepo   ChatRepo
	activityUC ActivityUseCase
	llm        LLMProvider
	tts        TTSService
}

func NewUseCase(chatRepo ChatRepo, activityUC ActivityUseCase, llm ...LLMProvider) *UseCase {
	uc := &UseCase{
		chatRepo:   chatRepo,
		activityUC: activityUC,
	}
	if len(llm) > 0 {
		uc.llm = llm[0]
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

func (uc *UseCase) SendMessageWithReply(ctx context.Context, userID string, sessionID string, content string) (*domain.Message, error) {
	if _, err := uc.SaveMessage(ctx, userID, sessionID, domain.RoleUser, content); err != nil {
		return nil, err
	}

	reply := uc.fallbackReply(content)
	if uc.llm != nil {
		ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
		defer cancel()

		replyChan, err := uc.llm.StreamReply(ctx, strings.TrimSpace(content))
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
	}

	msg := &domain.Message{
		SessionID: sessionID,
		Role:      domain.RoleAI,
		Content:   reply,
	}
	if err := uc.chatRepo.SaveMessage(ctx, msg); err != nil {
		return nil, fmt.Errorf("save ai reply: %w", err)
	}
	if uc.tts != nil {
		ttsCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		audioURL, err := uc.tts.GenerateAudio(ttsCtx, reply)
		if err != nil {
			slog.Warn("chat tts failed", "error", err, "session_id", sessionID)
		} else {
			msg.AudioURL = audioURL
		}
	}

	return msg, nil
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
