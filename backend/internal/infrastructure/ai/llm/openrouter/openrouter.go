package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

const requestTimeout = 30 * time.Second

type Provider struct {
	apiKey      string
	url         string
	model       string
	httpReferer string
	appTitle    string
	httpClient  *http.Client
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model          string         `json:"model"`
	Messages       []message      `json:"messages"`
	Temperature    float32        `json:"temperature,omitempty"`
	MaxTokens      int            `json:"max_tokens,omitempty"`
	ResponseFormat map[string]any `json:"response_format,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Code    any    `json:"code"`
	} `json:"error,omitempty"`
}

func NewProvider(apiKey, url, model, httpReferer, appTitle string) (*Provider, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, fmt.Errorf("openrouter llm: empty api key")
	}
	url = strings.TrimSpace(url)
	if url == "" {
		return nil, fmt.Errorf("openrouter llm: empty url")
	}
	model = strings.TrimSpace(model)
	if model == "" {
		return nil, fmt.Errorf("openrouter llm: empty model")
	}
	return &Provider{
		apiKey:      apiKey,
		url:         url,
		model:       model,
		httpReferer: strings.TrimSpace(httpReferer),
		appTitle:    strings.TrimSpace(appTitle),
		httpClient:  &http.Client{Timeout: requestTimeout},
	}, nil
}

func (p *Provider) StreamReply(ctx context.Context, transcript, cefrLevel string) (<-chan string, error) {
	out := make(chan string, 1)
	go func() {
		defer close(out)
		text, err := p.complete(ctx, []message{
			{Role: "system", Content: coachSystemPrompt(cefrLevel)},
			{Role: "user", Content: transcript},
		}, false)
		if err != nil {
			slog.Warn("openrouter stream reply failed", "error", err)
			return
		}
		if text = strings.TrimSpace(text); text != "" {
			out <- text
		}
	}()
	return out, nil
}

func (p *Provider) Translate(ctx context.Context, text, targetLang string) (string, error) {
	translated, err := p.complete(ctx, []message{
		{Role: "system", Content: translationPrompt(targetLang)},
		{Role: "user", Content: text},
	}, false)
	return strings.TrimSpace(translated), err
}

func coachSystemPrompt(cefrLevel string) string {
	level := strings.ToUpper(strings.TrimSpace(cefrLevel))
	if level == "" {
		level = "A1"
	}
	return fmt.Sprintf(`You are Noona, a cheerful, friendly English speaking coach inside a chat app.
The learner self-selected CEFR level is %s. Adapt your vocabulary, sentence length, and question difficulty to this level.
Reply in plain text only: no Markdown, no asterisks, no bullet symbols, no emojis.
Naturally model correct grammar by rephrasing the learner's idea in fluent English; do not point out mistakes or mention grammar errors.
Every reply must include one recommendation, fact, tip, or opinion.
IMPORTANT RULE:
- Maximum 2-3 sentences per reply.
- Each sentence max 20-25 words.
- Get to the point quickly.
End with either a question or a suggestion.
Rotate conversation themes when the user's context allows, using this cycle: everyday life, work, food, travel, movies, music, technology, a random personal anecdote.
If the user says hello/hey/hi, greet them briefly and start with the next simple themed speaking prompt.`, level)
}

func translationPrompt(targetLang string) string {
	langName := "Russian"
	if strings.ToLower(strings.TrimSpace(targetLang)) == "kk" {
		langName = "Kazakh"
	}
	return fmt.Sprintf(`Translate to %s.
Return only the translation, no explanations.`, langName)
}

func (p *Provider) QuickFeedback(ctx context.Context, transcript string) (*linguistic.QuickFeedback, error) {
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	text, err := p.complete(ctx, []message{
		{Role: "system", Content: `You are Noona, a fast English speaking coach.
Correct the learner's sentence with minimal latency.
Return only valid JSON:
{
  "corrected_text": "string",
  "reason": "one short reason, max 16 words",
  "original": "string"
}
Focus on the single most important mistake. Keep it short.`},
		{Role: "user", Content: transcript},
	}, true)
	if err != nil {
		return nil, err
	}

	var feedback linguistic.QuickFeedback
	if err := json.Unmarshal([]byte(sanitizeJSON(text)), &feedback); err != nil {
		return nil, fmt.Errorf("openrouter quick feedback malformed json: %w", err)
	}
	if strings.TrimSpace(feedback.CorrectedText) == "" {
		feedback.CorrectedText = transcript
	}
	if strings.TrimSpace(feedback.Reason) == "" {
		feedback.Reason = "A clearer corrected version is shown above."
	}
	if strings.TrimSpace(feedback.Original) == "" {
		feedback.Original = transcript
	}
	return &feedback, nil
}

func (p *Provider) Analyze(ctx context.Context, transcript string) (*linguistic.AIAnalysis, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<(uint(attempt)-1)) * time.Second
			slog.Info("retrying openrouter analysis", "attempt", attempt+1, "backoff", backoff)
			timer := time.NewTimer(backoff)
			select {
			case <-ctx.Done():
				if !timer.Stop() {
					<-timer.C
				}
				return nil, ctx.Err()
			case <-timer.C:
			}
		}

		analysis, err := p.analyzeOnce(ctx, transcript)
		if err == nil {
			return analysis, nil
		}
		lastErr = err
		if !isRetryable(err) {
			break
		}
	}
	return nil, lastErr
}

func (p *Provider) analyzeOnce(ctx context.Context, transcript string) (*linguistic.AIAnalysis, error) {
	text, err := p.complete(ctx, []message{
		{Role: "system", Content: `You are Noona, an expert English linguistic analyst.
Analyze the user's spoken English transcript and provide feedback in JSON format.
Only include pronunciation mistakes when the transcript or upstream speech analysis provides explicit pronunciation evidence. Do not guess pronunciation from text alone.

The JSON schema must be:
{
  "correction": "string (the full corrected text)",
  "explanation": "string (brief explanation of rules)",
  "cefr_level": "string (A1, A2, B1, B2, C1, or C2)",
  "mistakes": [
    {
      "original": "string",
      "corrected": "string",
      "type": "string (grammar, vocabulary, or pronunciation)",
      "offset": integer
    }
  ],
  "suggested": ["string (2-3 follow-up questions or responses)"]
}
If the sentence is correct, return:
{
  "correction": "",
  "explanation": "Great sentence! No mistakes found.",
  "cefr_level": "B1",
  "mistakes": [],
  "suggested": []
}
Only output valid JSON.`},
		{Role: "user", Content: transcript},
	}, true)
	if err != nil {
		return nil, err
	}

	var analysis linguistic.AIAnalysis
	if err := json.Unmarshal([]byte(sanitizeJSON(text)), &analysis); err != nil {
		return nil, fmt.Errorf("openrouter analysis malformed json: %w", err)
	}
	validateAnalysis(&analysis)
	return &analysis, nil
}

func (p *Provider) complete(ctx context.Context, messages []message, jsonMode bool) (string, error) {
	reqBody := chatRequest{
		Model:       p.model,
		Messages:    messages,
		Temperature: 0.2,
		MaxTokens:   700,
	}
	if jsonMode {
		reqBody.ResponseFormat = map[string]any{"type": "json_object"}
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("openrouter llm: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("openrouter llm: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	if p.httpReferer != "" {
		req.Header.Set("HTTP-Referer", p.httpReferer)
	}
	if p.appTitle != "" {
		req.Header.Set("X-Title", p.appTitle)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openrouter llm: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("openrouter llm: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(respBytes))
		var parsed chatResponse
		if err := json.Unmarshal(respBytes, &parsed); err == nil && parsed.Error != nil && parsed.Error.Message != "" {
			msg = parsed.Error.Message
		}
		return "", mapHTTPError(resp.StatusCode, msg)
	}

	var parsed chatResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return "", fmt.Errorf("openrouter llm: unmarshal response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("openrouter llm: empty choices")
	}
	return parsed.Choices[0].Message.Content, nil
}

func sanitizeJSON(raw string) string {
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start == -1 || end == -1 || end <= start {
		return raw
	}
	return raw[start : end+1]
}

func validateAnalysis(a *linguistic.AIAnalysis) {
	if strings.TrimSpace(a.Correction) == "" {
		a.Correction = ""
	}

	validLevels := map[string]bool{"A1": true, "A2": true, "B1": true, "B2": true, "C1": true, "C2": true}
	a.CEFRLevel = strings.ToUpper(strings.TrimSpace(a.CEFRLevel))
	if !validLevels[a.CEFRLevel] {
		a.CEFRLevel = "Unknown"
	}
	if a.Suggested == nil {
		a.Suggested = []string{}
	}
}

func mapHTTPError(statusCode int, message string) error {
	switch statusCode {
	case http.StatusTooManyRequests:
		return fmt.Errorf("retryable error (quota): openrouter llm returned %d: %s", statusCode, message)
	case http.StatusRequestTimeout, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return fmt.Errorf("retryable error (network): openrouter llm returned %d: %s", statusCode, message)
	default:
		return fmt.Errorf("openrouter llm returned %d: %s", statusCode, message)
	}
}

func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	text := err.Error()
	return strings.Contains(text, "retryable") || strings.Contains(text, "malformed json")
}
