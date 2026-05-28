package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type GeminiProvider struct {
	client    *genai.Client
	modelName string
}

func NewGeminiProvider(ctx context.Context, apiKey string, modelName string) (*GeminiProvider, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create gemini client: %w", err)
	}

	return &GeminiProvider{
		client:    client,
		modelName: modelName,
	}, nil
}

func (p *GeminiProvider) getModel() *genai.GenerativeModel {
	model := p.client.GenerativeModel(p.modelName)
	// Safety Settings: BLOCK_ONLY_HIGH to avoid false positives in educational context
	model.SafetySettings = []*genai.SafetySetting{
		{Category: genai.HarmCategoryHarassment, Threshold: genai.HarmBlockOnlyHigh},
		{Category: genai.HarmCategoryHateSpeech, Threshold: genai.HarmBlockOnlyHigh},
		{Category: genai.HarmCategorySexuallyExplicit, Threshold: genai.HarmBlockOnlyHigh},
		{Category: genai.HarmCategoryDangerousContent, Threshold: genai.HarmBlockOnlyHigh},
	}
	return model
}

func (p *GeminiProvider) StreamReply(ctx context.Context, transcript string) (<-chan string, error) {
	out := make(chan string)

	model := p.getModel()
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(`You are Noona, an English speaking coach inside a chat app.
Reply in plain text only: no Markdown, no asterisks, no bullet symbols, no emojis.
If the user says hello/hey/hi, greet them briefly and ask one simple speaking question.
If the user writes an English sentence, correct the most important issue and ask one short follow-up question.
Keep replies under 45 words.`)},
	}

	iter := model.GenerateContentStream(ctx, genai.Text(transcript))

	go func() {
		defer close(out)
		for {
			resp, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				slog.Error("gemini stream error", "error", err)
				return
			}

			if len(resp.Candidates) > 0 && resp.Candidates[0].Content != nil {
				for _, part := range resp.Candidates[0].Content.Parts {
					if text, ok := part.(genai.Text); ok {
						out <- string(text)
					}
				}
			}
		}
	}()

	return out, nil
}

func (p *GeminiProvider) QuickFeedback(ctx context.Context, transcript string) (*linguistic.QuickFeedback, error) {
	model := p.getModel()
	model.ResponseMIMEType = "application/json"
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(`You are Noona, a fast English speaking coach.
Correct the learner's sentence with minimal latency.
Return only valid JSON:
{
  "corrected_text": "string",
  "reason": "one short reason, max 16 words",
  "original": "string"
}
Focus on the single most important mistake. Keep it short.`)},
	}

	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	resp, err := model.GenerateContent(ctx, genai.Text(transcript))
	if err != nil {
		return nil, p.mapError(err)
	}
	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini quick feedback returned empty response")
	}
	textPart, ok := resp.Candidates[0].Content.Parts[0].(genai.Text)
	if !ok {
		return nil, fmt.Errorf("gemini quick feedback returned non-text part")
	}

	var feedback linguistic.QuickFeedback
	if err := json.Unmarshal([]byte(p.sanitizeJSON(string(textPart))), &feedback); err != nil {
		return nil, fmt.Errorf("malformed quick feedback json: %w", err)
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

func (p *GeminiProvider) Analyze(ctx context.Context, transcript string) (*linguistic.AIAnalysis, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<(uint(attempt)-1)) * time.Second
			slog.Info("retrying gemini analysis", "attempt", attempt+1, "backoff", backoff)

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

		logRaw := (attempt == 2)
		analysis, err := p.analyzeOnce(ctx, transcript, logRaw)
		if err == nil {
			return analysis, nil
		}

		lastErr = err
		if !p.isRetryable(err) {
			break
		}
	}
	return nil, lastErr
}

func (p *GeminiProvider) analyzeOnce(ctx context.Context, transcript string, logRaw bool) (*linguistic.AIAnalysis, error) {
	model := p.getModel()
	model.ResponseMIMEType = "application/json"
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(`You are Noona, an expert English linguistic analyst. 
Analyze the user's spoken English transcript and provide feedback in JSON format.

EXAMPLE:
Transcript: "I have go to school yesterday"
Response:
{
  "correction": "I went to school yesterday.",
  "explanation": "To talk about a finished action in the past, use the Past Simple form of the verb 'go', which is 'went'.",
  "cefr_level": "A2",
  "mistakes": [
    {
      "original": "have go",
      "corrected": "went",
      "type": "grammar",
      "offset": 2
    }
  ],
  "suggested": ["What did you do at school?", "How was your day?"]
}

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
      "offset": integer (start position of the mistake in the original text)"
    }
  ],
  "suggested": ["string (2-3 follow-up questions or responses)"]
}
Only output valid JSON.`)},
	}

	resp, err := model.GenerateContent(ctx, genai.Text(transcript))
	if err != nil {
		return nil, p.mapError(err)
	}

	if len(resp.Candidates) == 0 {
		return nil, fmt.Errorf("gemini returned no candidates")
	}

	candidate := resp.Candidates[0]
	if candidate.FinishReason != genai.FinishReasonStop {
		return nil, fmt.Errorf("gemini stopped unexpectedly: reason=%v, safety=%v", candidate.FinishReason, candidate.SafetyRatings)
	}

	if candidate.Content == nil || len(candidate.Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini returned empty response")
	}

	part := candidate.Content.Parts[0]
	textPart, ok := part.(genai.Text)
	if !ok {
		return nil, fmt.Errorf("gemini returned non-text part")
	}

	rawJSON := string(textPart)
	sanitized := p.sanitizeJSON(rawJSON)

	var analysis linguistic.AIAnalysis
	if err := json.Unmarshal([]byte(sanitized), &analysis); err != nil {
		if logRaw {
			slog.Error("failed to unmarshal gemini analysis on last attempt", "error", err, "raw", rawJSON)
		}
		return nil, fmt.Errorf("malformed json: %w", err)
	}

	// Validate mandatory fields and enums
	p.validateAnalysis(&analysis)

	return &analysis, nil
}

func (p *GeminiProvider) sanitizeJSON(raw string) string {
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

func (p *GeminiProvider) validateAnalysis(a *linguistic.AIAnalysis) {
	if a.Correction == "" {
		a.Correction = "I couldn't generate a correction, but I'm here to help!"
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

func (p *GeminiProvider) isRetryable(err error) bool {
	if strings.Contains(err.Error(), "retryable") {
		return true
	}
	if strings.Contains(err.Error(), "malformed json") {
		return true
	}
	return false
}

func (p *GeminiProvider) mapError(err error) error {
	st, ok := status.FromError(err)
	if !ok {
		return err
	}

	switch st.Code() {
	case codes.ResourceExhausted:
		return fmt.Errorf("retryable error (quota): %w", err)
	case codes.InvalidArgument, codes.Unimplemented:
		return fmt.Errorf("non-retryable error (invalid request): %w", err)
	case codes.DeadlineExceeded, codes.Unavailable:
		return fmt.Errorf("retryable error (network): %w", err)
	default:
		return err
	}
}

func (p *GeminiProvider) Close() error {
	return p.client.Close()
}
