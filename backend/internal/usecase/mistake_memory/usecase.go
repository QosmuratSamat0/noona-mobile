package mistake_memory

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Service struct {
	repo Repository
	now  func() time.Time
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) UpsertFromMistakes(ctx context.Context, userID string, mistakes []learning.Mistake) ([]learning.MistakeMemory, error) {
	memories := make([]learning.MistakeMemory, 0, len(mistakes))
	for _, mistake := range mistakes {
		memory, err := s.UpsertOne(ctx, userID, mistake)
		if err != nil {
			return nil, err
		}
		memories = append(memories, *memory)
	}
	return memories, nil
}

func (s *Service) UpsertOne(ctx context.Context, userID string, mistake learning.Mistake) (*learning.MistakeMemory, error) {
	now := s.now().UTC()
	mistake.PatternKey = normalizePatternKey(mistake)
	mistake.Type = normalizeType(mistake.Type)
	mistake.Title = titleOrDefault(mistake)

	existing, err := s.repo.GetByPattern(ctx, userID, mistake.PatternKey)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		memory := &learning.MistakeMemory{
			UserID:            userID,
			PatternKey:        mistake.PatternKey,
			Type:              mistake.Type,
			Title:             mistake.Title,
			Description:       strings.TrimSpace(mistake.Explanation),
			TotalCount:        1,
			RecentCount:       1,
			FirstSeenAt:       now,
			LastSeenAt:        now,
			Status:            "active",
			LastOriginalText:  mistake.OriginalText,
			LastCorrectedText: mistake.CorrectedText,
			UpdatedAt:         now,
		}
		if err := s.repo.Create(ctx, memory); err != nil {
			return nil, err
		}
		return memory, nil
	}

	if existing.LastSeenAt.After(now.AddDate(0, 0, -7)) {
		existing.RecentCount++
	} else {
		existing.RecentCount = 1
	}
	existing.TotalCount++
	existing.Type = mistake.Type
	existing.Title = mistake.Title
	if strings.TrimSpace(mistake.Explanation) != "" {
		existing.Description = strings.TrimSpace(mistake.Explanation)
	}
	existing.LastSeenAt = now
	existing.UpdatedAt = now
	existing.LastOriginalText = mistake.OriginalText
	existing.LastCorrectedText = mistake.CorrectedText
	existing.Status = statusFor(*existing, now)

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) ListSummary(ctx context.Context, userID string) (*learning.MemorySummary, error) {
	memories, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	summary := &learning.MemorySummary{}
	for _, memory := range memories {
		switch memory.Status {
		case "fixed":
			summary.Fixed = append(summary.Fixed, memory)
		case "improving":
			summary.Improving = append(summary.Improving, memory)
		default:
			summary.TopMistakes = append(summary.TopMistakes, memory)
		}
	}
	return summary, nil
}

func statusFor(memory learning.MistakeMemory, now time.Time) string {
	if memory.TotalCount >= 2 && memory.RecentCount == 0 && memory.LastSeenAt.Before(now.AddDate(0, 0, -14)) {
		return "fixed"
	}
	if memory.TotalCount >= 3 && memory.RecentCount <= 1 {
		return "improving"
	}
	return "active"
}

func normalizePatternKey(m learning.Mistake) string {
	key := strings.ToLower(strings.TrimSpace(m.PatternKey))
	if key != "" {
		return key
	}
	kind := normalizeType(m.Type)
	title := strings.ToLower(strings.TrimSpace(m.Title))
	title = strings.ReplaceAll(title, " ", "_")
	title = strings.Trim(title, "._-")
	if title != "" {
		return kind + "." + title
	}
	raw := strings.ToLower(strings.TrimSpace(m.OriginalText + "_" + m.CorrectedText))
	raw = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			return r
		}
		return '_'
	}, raw)
	raw = strings.Trim(raw, "_")
	if raw == "" {
		raw = "general"
	}
	return fmt.Sprintf("%s.%s", kind, raw)
}

func normalizeType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "grammar", "vocabulary", "pronunciation":
		return value
	default:
		if value == "" {
			return "grammar"
		}
		return value
	}
}

func titleOrDefault(m learning.Mistake) string {
	if title := strings.TrimSpace(m.Title); title != "" {
		return title
	}
	key := normalizePatternKey(m)
	parts := strings.Split(key, ".")
	label := parts[len(parts)-1]
	label = strings.ReplaceAll(label, "_", " ")
	if label == "" || label == "general" {
		return "English pattern"
	}
	return strings.Title(label)
}
