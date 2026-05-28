package stt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
)

const groqDefaultTimeout = 45 * time.Second

type GroqClient struct {
	httpClient *http.Client
	apiKey     string
	url        string
	model      string
	minio      *minio.Client
	bucketName string
	timeout    time.Duration
}

type groqTranscriptionResponse struct {
	Text string `json:"text"`
}

func NewGroqClient(apiKey, url, model string, minioClient *minio.Client, bucketName string, timeout time.Duration) (*GroqClient, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, fmt.Errorf("groq stt: missing GROQ_API_KEY")
	}
	if strings.TrimSpace(url) == "" {
		url = "https://api.groq.com/openai/v1/audio/transcriptions"
	}
	if strings.TrimSpace(model) == "" {
		model = "whisper-large-v3-turbo"
	}
	if timeout <= 0 {
		timeout = groqDefaultTimeout
	}

	return &GroqClient{
		httpClient: &http.Client{Timeout: timeout},
		apiKey:     apiKey,
		url:        url,
		model:      model,
		minio:      minioClient,
		bucketName: bucketName,
		timeout:    timeout,
	}, nil
}

func (c *GroqClient) Transcribe(ctx context.Context, filePath string) (string, error) {
	if c.minio == nil {
		return "", fmt.Errorf("groq stt: minio client is nil")
	}

	objectKey := normalizeObjectKey(c.bucketName, filePath)
	obj, err := c.minio.GetObject(ctx, c.bucketName, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return "", fmt.Errorf("groq stt: get minio object %q: %w", objectKey, err)
	}
	defer obj.Close()

	return c.TranscribeReader(ctx, obj, "en")
}

func (c *GroqClient) TranscribeReader(ctx context.Context, audio io.Reader, language string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fileWriter, err := writer.CreateFormFile("file", "audio.m4a")
	if err != nil {
		return "", fmt.Errorf("groq stt: create multipart file: %w", err)
	}
	if _, err := io.Copy(fileWriter, audio); err != nil {
		return "", fmt.Errorf("groq stt: copy audio: %w", err)
	}

	if err := writer.WriteField("model", c.model); err != nil {
		return "", fmt.Errorf("groq stt: write model field: %w", err)
	}
	if strings.TrimSpace(language) != "" {
		if err := writer.WriteField("language", strings.TrimSpace(language)); err != nil {
			return "", fmt.Errorf("groq stt: write language field: %w", err)
		}
	}
	if err := writer.WriteField("response_format", "json"); err != nil {
		return "", fmt.Errorf("groq stt: write response format field: %w", err)
	}
	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("groq stt: close multipart body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, &body)
	if err != nil {
		return "", fmt.Errorf("groq stt: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("groq stt: request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", fmt.Errorf("groq stt: read response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("groq stt: status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var parsed groqTranscriptionResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("groq stt: decode response: %w", err)
	}
	text := strings.TrimSpace(parsed.Text)
	if text == "" {
		return "", fmt.Errorf("groq stt: empty transcript")
	}
	return text, nil
}

func (c *GroqClient) Close() error {
	return nil
}
