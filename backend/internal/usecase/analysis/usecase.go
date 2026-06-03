package analysis

import (
	"context"
	"fmt"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type MemoryService interface {
	ListSummary(ctx context.Context, userID string) (*learning.MemorySummary, error)
}

type VocabularyService interface {
	GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error)
}

type DailyService interface {
	Today(ctx context.Context, userID string) (*learning.DailySession, error)
}

type Service struct {
	memory     MemoryService
	vocabulary VocabularyService
	daily      DailyService
}

func NewService(memory MemoryService, vocabulary VocabularyService, daily DailyService) *Service {
	return &Service{memory: memory, vocabulary: vocabulary, daily: daily}
}

func (s *Service) GetMine(ctx context.Context, userID string) (*learning.AnalysisSummary, error) {
	memory, err := s.memory.ListSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	vocab, err := s.vocabulary.GetToday(ctx, userID)
	if err != nil {
		return nil, err
	}
	today, _ := s.daily.Today(ctx, userID)

	focus := "Build a longer answer"
	reason := "No repeated weak pattern stands out yet."
	next := []string{"Use 2 new words next time.", "Make your next answer at least 2 sentences."}
	top := make([]learning.MistakeView, 0, len(memory.TopMistakes))
	if len(memory.TopMistakes) > 0 {
		main := memory.TopMistakes[0]
		focus = main.Title
		reason = fmt.Sprintf("%s appeared %d times, with %d recent examples.", main.Title, main.TotalCount, main.RecentCount)
		next = []string{fmt.Sprintf("Practice 5 sentences using %s.", main.Title), "Record one answer and check if this pattern repeats."}
	}
	for _, item := range memory.TopMistakes {
		top = append(top, learning.MistakeView{
			PatternKey:  item.PatternKey,
			Title:       item.Title,
			TotalCount:  item.TotalCount,
			RecentCount: item.RecentCount,
			Status:      item.Status,
			Message:     fmt.Sprintf("You often repeat %s.", item.Title),
		})
		if len(top) == 3 {
			break
		}
	}

	return &learning.AnalysisSummary{
		Focus:       focus,
		Reason:      reason,
		NextSteps:   next,
		TopMistakes: top,
		Vocabulary:  vocab,
		Daily:       today,
	}, nil
}
