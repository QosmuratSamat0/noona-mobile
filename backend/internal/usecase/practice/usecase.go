package practice

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/results"
)

type Service struct {
	stt     STTService
	storage AudioStorage
	results ResultService
}

func NewService(stt STTService, storage AudioStorage, results ResultService) *Service {
	return &Service{stt: stt, storage: storage, results: results}
}

func (s *Service) SubmitText(ctx context.Context, input TextInput) (*learning.ResultView, error) {
	return s.results.CreateFromText(ctx, results.CreateInput{
		UserID:         input.UserID,
		Text:           strings.TrimSpace(input.Text),
		DailySessionID: input.DailySessionID,
	})
}

func (s *Service) SubmitAudio(ctx context.Context, input AudioInput) (*learning.ResultView, error) {
	if s.stt == nil {
		return nil, fmt.Errorf("stt service is not configured")
	}
	audioBytes, err := io.ReadAll(io.LimitReader(input.File, 32<<20))
	if err != nil {
		return nil, fmt.Errorf("read audio: %w", err)
	}
	if len(audioBytes) == 0 {
		return nil, fmt.Errorf("empty audio")
	}
	transcript, err := s.stt.TranscribeReader(ctx, bytes.NewReader(audioBytes), "en")
	if err != nil {
		return nil, err
	}
	transcript = strings.TrimSpace(transcript)
	if transcript == "" {
		return nil, fmt.Errorf("empty transcript")
	}

	audioURL := ""
	if s.storage != nil {
		filePath, err := s.storage.UploadFile(ctx, bytes.NewReader(audioBytes), int64(len(audioBytes)), input.ContentType, input.Ext)
		if err != nil {
			return nil, err
		}
		audioURL, err = s.storage.FileURL(ctx, filePath)
		if err != nil {
			return nil, err
		}
	}

	return s.results.CreateFromText(ctx, results.CreateInput{
		UserID:         input.UserID,
		Text:           transcript,
		AudioURL:       audioURL,
		DailySessionID: input.DailySessionID,
	})
}
