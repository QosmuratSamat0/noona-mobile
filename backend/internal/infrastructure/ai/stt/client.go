// Package stt implements the STTService interface defined in the audio usecase.
// It calls the Python faster-whisper microservice via HTTP.
package stt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// transcribeRequest matches the Python service's TranscribeRequest schema.
type transcribeRequest struct {
	FilePath   string  `json:"file_path"`
	BucketName string  `json:"bucket_name"`
	Language   *string `json:"language,omitempty"`
	BeamSize   int     `json:"beam_size"`
}

// transcribeResponse matches the Python service's TranscribeResponse schema.
type transcribeResponse struct {
	Text            string   `json:"text"`
	Language        string   `json:"language"`
	DurationSeconds float64  `json:"duration_seconds"`
	Segments        []segment `json:"segments"`
}

type segment struct {
	ID          int     `json:"id"`
	Start       float64 `json:"start"`
	End         float64 `json:"end"`
	Text        string  `json:"text"`
	AvgLogProb  float64 `json:"avg_logprob"`
	NoSpeechProb float64 `json:"no_speech_prob"`
}

// Client is the HTTP adapter for the Python STT microservice.
// It satisfies the audio.STTService interface.
type Client struct {
	baseURL    string
	bucketName string
	httpClient *http.Client
}

// NewClient creates a new STT HTTP adapter.
//
//	baseURL    – Python service base URL, e.g. "http://localhost:8001"
//	bucketName – MinIO bucket where audio files are stored (e.g. "voice-input")
//	timeout    – Per-request timeout; set > longest expected audio duration.
func NewClient(baseURL, bucketName string, timeout time.Duration) *Client {
	return &Client{
		baseURL:    baseURL,
		bucketName: bucketName,
		httpClient: &http.Client{Timeout: timeout},
	}
}

// Transcribe implements audio.STTService.
// filePath is the MinIO object key (e.g. "audio/uuid.webm").
func (c *Client) Transcribe(ctx context.Context, filePath string) (string, error) {
	reqBody := transcribeRequest{
		FilePath:   filePath,
		BucketName: c.bucketName,
		BeamSize:   5,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("stt: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/transcribe",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("stt: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	slog.Debug("calling STT service", "file_path", filePath, "url", req.URL.String())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("stt: HTTP call failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("stt: read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("stt: service returned %d: %s", resp.StatusCode, respBytes)
	}

	var result transcribeResponse
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", fmt.Errorf("stt: unmarshal response: %w", err)
	}

	slog.Info("stt response received",
		"language", result.Language,
		"duration_s", result.DurationSeconds,
		"segments", len(result.Segments),
		"text_length", len(result.Text),
	)

	return result.Text, nil
}
