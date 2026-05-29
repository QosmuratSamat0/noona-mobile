package audio

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
	chatDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/google/uuid"
)

type UseCase struct {
	storage    StorageRepo
	jobRepo    JobRepo
	chatRepo   ChatRepo
	userRepo   UserRepo
	activityUC ActivityUseCase
	stt        STTService
	llm        LLMProvider
	tts        TTSService
	ws         WSPusher
	linguistic LinguisticUseCase
}

func NewUseCase(storage StorageRepo, jobRepo JobRepo, activityUC ActivityUseCase) *UseCase {
	return &UseCase{
		storage:    storage,
		jobRepo:    jobRepo,
		activityUC: activityUC,
	}
}

func NewLowLatencyUseCase(
	storage StorageRepo,
	jobRepo JobRepo,
	chatRepo ChatRepo,
	userRepo UserRepo,
	activityUC ActivityUseCase,
	stt STTService,
	llm LLMProvider,
	tts TTSService,
	ws WSPusher,
	linguistic LinguisticUseCase,
) *UseCase {
	return &UseCase{
		storage:    storage,
		jobRepo:    jobRepo,
		chatRepo:   chatRepo,
		userRepo:   userRepo,
		activityUC: activityUC,
		stt:        stt,
		llm:        llm,
		tts:        tts,
		ws:         ws,
		linguistic: linguistic,
	}
}

func (uc *UseCase) UploadAudio(ctx context.Context, userID, sessionID string, file io.Reader, fileSize int64, contentType, ext string) (string, error) {
	if uc.stt != nil && uc.llm != nil && uc.ws != nil {
		return uc.uploadAudioFast(ctx, userID, sessionID, file, fileSize, contentType, ext)
	}

	filePath, err := uc.storage.UploadFile(ctx, file, fileSize, contentType, ext)
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	jobID := uuid.New().String()

	job := audio.Job{
		JobID:    jobID,
		UserID:   userID,
		FilePath: filePath,
	}

	if err := uc.jobRepo.CreateJob(ctx, job); err != nil {
		if cleanupErr := uc.storage.DeleteFile(ctx, filePath); cleanupErr != nil {
			slog.Error("failed to cleanup orphaned file", "error", cleanupErr, "file_path", filePath)
		}
		return "", fmt.Errorf("failed to create job: %w", err)
	}

	if err := uc.activityUC.RecordActivity(ctx, userID); err != nil {
		slog.Error("failed to record activity on audio upload", "error", err, "user_id", userID)
	}

	return jobID, nil
}

func (uc *UseCase) uploadAudioFast(ctx context.Context, userID, sessionID string, file io.Reader, fileSize int64, contentType, ext string) (string, error) {
	audioBytes, err := io.ReadAll(io.LimitReader(file, 32<<20))
	if err != nil {
		return "", fmt.Errorf("failed to read audio: %w", err)
	}
	if len(audioBytes) == 0 {
		return "", fmt.Errorf("empty audio")
	}

	jobID := uuid.New().String()
	go uc.processFastPath(context.Background(), jobID, userID, sessionID, audioBytes, fileSize, contentType, ext)

	return jobID, nil
}

func (uc *UseCase) processFastPath(ctx context.Context, jobID, userID, sessionID string, audioBytes []byte, fileSize int64, contentType, ext string) {
	started := time.Now()
	log := slog.With("job_id", jobID, "user_id", userID)
	log.Info("fast audio path started", "bytes", len(audioBytes), "content_type", contentType)

	sttCtx, cancelSTT := context.WithTimeout(ctx, 12*time.Second)
	defer cancelSTT()

	transcript, err := uc.stt.TranscribeReader(sttCtx, bytes.NewReader(audioBytes), "en")
	if err != nil {
		log.Error("fast path stt failed", "error", err)
		_ = uc.ws.PushToUser(ctx, userID, map[string]any{
			"type": "audio_error",
			"data": map[string]any{"job_id": jobID, "stage": "stt", "error": err.Error()},
		})
		return
	}
	transcript = strings.TrimSpace(transcript)
	if transcript == "" {
		_ = uc.ws.PushToUser(ctx, userID, map[string]any{
			"type": "audio_error",
			"data": map[string]any{"job_id": jobID, "stage": "stt", "error": "empty transcript"},
		})
		return
	}
	_ = uc.ws.PushToUser(ctx, userID, map[string]any{
		"type": "transcript_final",
		"data": map[string]any{"job_id": jobID, "text": transcript},
	})
	userMessage := uc.saveChatMessage(ctx, log, userID, sessionID, chatDomain.RoleUser, transcript, "")

	feedback, err := uc.llm.QuickFeedback(ctx, transcript)
	if err != nil {
		log.Error("quick feedback failed, using transcript fallback", "error", err)
		feedback = &linguistic.QuickFeedback{
			Original:      transcript,
			CorrectedText: transcript,
			Reason:        "I heard your sentence. Full feedback is coming.",
		}
	}
	_ = uc.ws.PushToUser(ctx, userID, map[string]any{
		"type": "quick_feedback",
		"data": map[string]any{
			"job_id":         jobID,
			"corrected_text": feedback.CorrectedText,
			"reason":         feedback.Reason,
			"original":       feedback.Original,
		},
	})
	log.Info("fast audio path completed", "latency_ms", time.Since(started).Milliseconds())

	go uc.processBackgroundPath(context.Background(), jobID, userID, sessionID, transcript, feedback, userMessage, audioBytes, fileSize, contentType, ext)
}

func (uc *UseCase) processBackgroundPath(ctx context.Context, jobID, userID, sessionID, transcript string, feedback *linguistic.QuickFeedback, userMessage *chatDomain.Message, audioBytes []byte, fileSize int64, contentType, ext string) {
	_ = fileSize
	log := slog.With("job_id", jobID, "user_id", userID)

	if uc.activityUC != nil {
		if err := uc.activityUC.RecordActivity(ctx, userID); err != nil {
			log.Error("background activity save failed", "error", err)
		}
	}

	if uc.storage != nil {
		if _, err := uc.storage.UploadFile(ctx, bytes.NewReader(audioBytes), int64(len(audioBytes)), contentType, ext); err != nil {
			log.Error("background minio upload failed", "error", err)
		}
	}

	var analysis *linguistic.AIAnalysis
	if uc.llm != nil {
		var err error
		analysis, err = uc.llm.Analyze(ctx, transcript)
		if err != nil {
			log.Error("background deep analysis failed", "error", err)
			analysis = &linguistic.AIAnalysis{
				Correction:  feedback.CorrectedText,
				Explanation: feedback.Reason,
				CEFRLevel:   "Unknown",
			}
		}
	}

	if uc.linguistic != nil && analysis != nil {
		messageID := ""
		if userMessage != nil {
			messageID = userMessage.ID
		}
		t, err := uc.linguistic.SaveTranscript(ctx, messageID, transcript)
		if err != nil {
			log.Error("background transcript save failed", "error", err)
		} else {
			if _, err := uc.linguistic.SaveCorrection(ctx, t.ID, analysis.Correction, analysis.Explanation, analysis.CEFRLevel); err != nil {
				log.Error("background correction save failed", "error", err)
			}
			for _, m := range analysis.Mistakes {
				if _, err := uc.linguistic.SaveMistake(ctx, userID, m.Type, m.Original, m.Corrected, m.Offset); err != nil {
					log.Error("background mistake save failed", "error", err)
				}
			}
		}

		_ = uc.ws.PushToUser(ctx, userID, map[string]any{
			"type": "deep_feedback",
			"data": map[string]any{"job_id": jobID, "analysis": analysis},
		})
	}

	if uc.tts == nil || uc.llm == nil {
		return
	}

	reply, err := collectStreamReply(ctx, uc.llm, transcript, uc.userCEFRLevel(ctx, userID))
	if err != nil {
		log.Error("background coach reply failed", "error", err)
		reply = fallbackCoachReply()
	}
	reply = strings.TrimSpace(reply)
	if reply == "" {
		reply = fallbackCoachReply()
	}

	_ = uc.ws.PushToUser(ctx, userID, map[string]any{
		"type": "coach_reply",
		"data": map[string]any{"job_id": jobID, "text": reply},
	})

	log.Info("background coach tts started")
	audioURL, err := uc.tts.GenerateAudio(ctx, reply)
	if err != nil {
		log.Error("background coach tts failed", "error", err)
		uc.saveChatMessage(ctx, log, userID, sessionID, chatDomain.RoleAI, reply, "")
		return
	}
	log.Info("background coach tts completed")
	uc.saveChatMessage(ctx, log, userID, sessionID, chatDomain.RoleAI, reply, audioURL)

	_ = uc.ws.PushToUser(ctx, userID, map[string]any{
		"type": "tts_ready",
		"data": map[string]any{"job_id": jobID, "audio_url": audioURL},
	})
}

func collectStreamReply(ctx context.Context, llm LLMProvider, transcript, cefrLevel string) (string, error) {
	replyChan, err := llm.StreamReply(ctx, transcript, cefrLevel)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	for chunk := range replyChan {
		builder.WriteString(chunk)
	}
	return builder.String(), nil
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

func fallbackCoachReply() string {
	return "Nice work. Open the grammar feedback to see what you can improve, then try the sentence again."
}

func (uc *UseCase) saveChatMessage(ctx context.Context, log *slog.Logger, userID, sessionID string, role chatDomain.Role, content, audioURL string) *chatDomain.Message {
	sessionID = strings.TrimSpace(sessionID)
	content = strings.TrimSpace(content)
	if uc.chatRepo == nil || sessionID == "" || content == "" {
		return nil
	}

	session, err := uc.chatRepo.GetSession(ctx, sessionID)
	if err != nil {
		log.Error("chat session lookup failed for audio message", "error", err, "session_id", sessionID)
		return nil
	}
	if session.UserID != userID {
		log.Error("audio message session access denied", "session_id", sessionID)
		return nil
	}

	msg := &chatDomain.Message{
		SessionID: sessionID,
		Role:      role,
		Content:   content,
		AudioURL:  strings.TrimSpace(audioURL),
	}
	if err := uc.chatRepo.SaveMessage(ctx, msg); err != nil {
		log.Error("audio chat message save failed", "error", err, "session_id", sessionID, "role", role)
		return nil
	}
	return msg
}
