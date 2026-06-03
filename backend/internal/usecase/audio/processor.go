package audio

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"golang.org/x/sync/errgroup"
)

type AudioProcessor struct {
	stt STTService
	llm LLMProvider
	tts TTSService
	ws  WSPusher
}

func NewAudioProcessor(stt STTService, llm LLMProvider, tts TTSService, ws WSPusher) *AudioProcessor {
	return &AudioProcessor{
		stt: stt,
		llm: llm,
		tts: tts,
		ws:  ws,
	}
}

func (p *AudioProcessor) ProcessJob(ctx context.Context, job audio.Job) error {
	slog.Info("processing job", "job_id", job.JobID, "user_id", job.UserID)

	// 1. STT - Whisper -> transcript
	transcript, err := p.stt.Transcribe(ctx, job.FilePath)
	if err != nil {
		slog.Error("stt failed", "job_id", job.JobID, "error", err)
		return fmt.Errorf("stt failed: %w", err)
	}
	slog.Info("stt completed", "job_id", job.JobID, "transcript_length", len(transcript))

	// 2. Parallel LLM work: Streaming Reply + Deep Analysis
	var analysis *linguistic.AIAnalysis
	g, gCtx := errgroup.WithContext(ctx)

	// Task A: Fast Streaming Reply for UI
	g.Go(func() error {
		replyChan, err := p.llm.StreamReply(gCtx, transcript, "A1")
		if err != nil {
			slog.Warn("stream reply failed; continuing without streaming", "job_id", job.JobID, "user_id", job.UserID, "error", err)
			return nil
		}

		for text := range replyChan {
			_ = p.ws.PushToUser(gCtx, job.UserID, linguistic.ResponseChunk{
				Text: text,
			})
		}
		_ = p.ws.PushToUser(gCtx, job.UserID, linguistic.ResponseChunk{
			IsFinal: true,
		})
		return nil
	})

	// Task B: Deep semantic analysis for websocket feedback.
	g.Go(func() error {
		var err error
		analysis, err = p.llm.Analyze(gCtx, transcript)
		if err != nil {
			slog.Error("llm analysis failed, using fallback", "job_id", job.JobID, "error", err)
			analysis = &linguistic.AIAnalysis{
				Correction: transcript,
				CEFRLevel:  "Unknown",
			}
		}

		return nil
	})

	if err := g.Wait(); err != nil {
		slog.Error("llm processing failed", "job_id", job.JobID, "error", err)
		return err
	}

	slog.Info("llm processing completed", "job_id", job.JobID)

	// Corrections belong to grammar feedback. Do not turn them into a chat/TTS reply.

	payload := map[string]interface{}{
		"type": "audio_processing_result",
		"data": map[string]interface{}{
			"job_id":     job.JobID,
			"transcript": transcript,
			"analysis":   analysis,
		},
	}

	if err := p.ws.PushToUser(ctx, job.UserID, payload); err != nil {
		slog.Error("ws push failed", "job_id", job.JobID, "error", err)
		return fmt.Errorf("ws push failed: %w", err)
	}

	slog.Info("job processed successfully", "job_id", job.JobID)
	return nil
}
