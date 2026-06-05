package vocabulary

import (
	"context"
	"regexp"
	"sort"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) TrackTranscript(ctx context.Context, userID, resultID, transcriptID, text string) (learning.VocabularyStats, error) {
	stats, words := AnalyzeText(text)
	if len(words) == 0 {
		return stats, nil
	}
	if err := s.repo.TrackWords(ctx, userID, resultID, transcriptID, words); err != nil {
		return stats, err
	}
	persisted, err := s.repo.GetResultStats(ctx, userID, resultID)
	if err != nil {
		return stats, err
	}
	return persisted, nil
}

func (s *Service) GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error) {
	return s.repo.GetTodayStats(ctx, userID)
}

var wordPattern = regexp.MustCompile(`[A-Za-z]+(?:'[A-Za-z]+)?`)

func AnalyzeText(text string) (learning.VocabularyStats, []learning.WordUsage) {
	matches := wordPattern.FindAllString(text, -1)
	seen := make(map[string]int)
	words := make([]learning.WordUsage, 0, len(matches))
	for _, match := range matches {
		normalized := strings.ToLower(strings.Trim(match, "'"))
		if normalized == "" {
			continue
		}
		seen[normalized]++
		words = append(words, learning.WordUsage{Word: match, Normalized: normalized})
	}

	repeated := make([]string, 0)
	for word, count := range seen {
		if count > 1 {
			repeated = append(repeated, word)
		}
	}
	sort.Strings(repeated)

	return learning.VocabularyStats{
		TotalWords:    len(words),
		UniqueWords:   len(seen),
		RepeatedWords: repeated,
		OverusedWords: overused(seen),
	}, words
}

func overused(counts map[string]int) []learning.WordSuggestion {
	alternatives := map[string][]string{
		"good": []string{"useful", "strong", "excellent"},
		"very": []string{"really", "extremely", "especially"},
		"nice": []string{"pleasant", "kind", "enjoyable"},
	}
	out := make([]learning.WordSuggestion, 0)
	for word, suggestions := range alternatives {
		if counts[word] >= 2 {
			out = append(out, learning.WordSuggestion{Word: word, Alternatives: suggestions})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Word < out[j].Word })
	return out
}
