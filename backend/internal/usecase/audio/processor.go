package audio

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
)

type AudioProcessor struct {
	stt STTService
	llm LLMService
	tts TTSService
	ws  WSPusher
}

func NewAudioProcessor(stt STTService, llm LLMService, tts TTSService, ws WSPusher) *AudioProcessor {
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

	// 2. LLM - GeminiClient -> analysis
	analysis, err := p.llm.Analyze(ctx, transcript)
	if err != nil {
		slog.Error("llm failed", "job_id", job.JobID, "error", err)
		return fmt.Errorf("llm failed: %w", err)
	}
	slog.Info("llm completed", "job_id", job.JobID, "analysis_length", len(analysis))

	// 3. TTS - Piper -> audio_url
	audioURL, err := p.tts.GenerateAudio(ctx, analysis)
	if err != nil {
		slog.Error("tts failed", "job_id", job.JobID, "error", err)
		return fmt.Errorf("tts failed: %w", err)
	}
	slog.Info("tts completed", "job_id", job.JobID, "audio_url", audioURL)

	payload := map[string]interface{}{
		"type": "audio_processing_result",
		"data": map[string]interface{}{
			"job_id":     job.JobID,
			"transcript": transcript,
			"analysis":   analysis,
			"audio_url":  audioURL,
		},
	}

	if err := p.ws.PushToUser(ctx, job.UserID, payload); err != nil {
		slog.Error("ws push failed", "job_id", job.JobID, "error", err)
		return fmt.Errorf("ws push failed: %w", err)
	}

	slog.Info("job processed successfully", "job_id", job.JobID)
	return nil
}
