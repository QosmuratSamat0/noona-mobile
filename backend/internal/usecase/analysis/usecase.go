package analysis

import (
	"context"
	"fmt"
	"sort"
	"strings"

	activityDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Dependencies struct {
	Results  ResultsReader
	Activity ActivityReader
}

type Service struct {
	memory     MemoryReader
	vocabulary VocabularyReader
	daily      DailyReader
	results    ResultsReader
	activity   ActivityReader
}

func NewService(memory MemoryReader, vocabulary VocabularyReader, daily DailyReader, deps Dependencies) *Service {
	return &Service{
		memory:     memory,
		vocabulary: vocabulary,
		daily:      daily,
		results:    deps.Results,
		activity:   deps.Activity,
	}
}

func (s *Service) GetMine(ctx context.Context, userID string) (*learning.AnalysisSummary, error) {
	memory, err := s.memory.ListSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	if memory == nil {
		memory = &learning.MemorySummary{}
	}
	vocab, err := s.vocabulary.GetToday(ctx, userID)
	if err != nil {
		return nil, err
	}

	today, err := s.daily.Today(ctx, userID)
	if err != nil {
		return nil, err
	}

	results, err := s.listResults(ctx, userID)
	if err != nil {
		return nil, err
	}

	streak, activityDays, err := s.getActivity(ctx, userID)
	if err != nil {
		return nil, err
	}

	topMistakes := mistakeViews(memory.TopMistakes, 3)
	fixedMistakes := mistakeViews(memory.Fixed, 3)
	progress := skillProgress(results)
	activity := activitySummary(streak, activityDays)
	focus, reason := focusAndReason(memory, today, progress)
	todayPlan := todayPlan(focus, memory, vocab, today, progress)
	nextSteps := nextSteps(todayPlan, memory, vocab)
	nextRecommendation := nextRecommendation(focus, memory, vocab, progress)

	return &learning.AnalysisSummary{
		Focus:              focus,
		Reason:             reason,
		NextSteps:          nextSteps,
		TopMistakes:        topMistakes,
		FixedMistakes:      fixedMistakes,
		TodayPlan:          todayPlan,
		Vocabulary:         vocab,
		SkillProgress:      progress,
		Activity:           activity,
		RecentResults:      recentResultInsights(results, 5),
		NextRecommendation: nextRecommendation,
		Daily:              today,
	}, nil
}

func (s *Service) listResults(ctx context.Context, userID string) ([]learning.Result, error) {
	if s.results == nil {
		return []learning.Result{}, nil
	}
	results, err := s.results.ListRecent(ctx, userID, 20)
	if err != nil {
		return nil, err
	}
	return sortResultsByNewest(results), nil
}

func (s *Service) getActivity(ctx context.Context, userID string) (*activityDomain.Streak, []*activityDomain.DailyStat, error) {
	if s.activity == nil {
		return nil, []*activityDomain.DailyStat{}, nil
	}
	return s.activity.GetActivity(ctx, userID)
}

func focusAndReason(memory *learning.MemorySummary, today *learning.DailySession, progress learning.SkillProgress) (string, string) {
	if memory != nil && len(memory.TopMistakes) > 0 {
		main := memory.TopMistakes[0]
		return main.Title, fmt.Sprintf("%s appeared %d times, with %d recent examples.", main.Title, main.TotalCount, main.RecentCount)
	}
	if today != nil && strings.TrimSpace(today.MainWeakPoint) != "" {
		return today.MainWeakPoint, "This is today's main weak point from your practice session."
	}
	if progress.TotalResults == 0 {
		return "Start today's practice", "No practice result exists yet, so the next step is to create a baseline answer."
	}
	return "Build a longer answer", "No repeated weak pattern stands out yet."
}

func todayPlan(focus string, memory *learning.MemorySummary, vocab learning.VocabularyStats, today *learning.DailySession, progress learning.SkillProgress) []string {
	plan := make([]string, 0, 4)
	if memory != nil && len(memory.TopMistakes) > 0 {
		plan = append(plan, fmt.Sprintf("Practice 5 sentences using %s.", memory.TopMistakes[0].Title))
	}
	if len(vocab.NewWords) > 0 {
		plan = append(plan, "Use 2 new words from today's vocabulary.")
	} else {
		plan = append(plan, "Add 2 new useful words to your next answer.")
	}
	if today == nil || today.TotalResults < 3 {
		plan = append(plan, "Complete 3 practice answers today.")
	}
	if progress.AverageScore < 75 {
		plan = append(plan, "Make your next answer at least 2 sentences.")
	}
	if len(plan) == 0 {
		plan = append(plan, fmt.Sprintf("Record one answer and check %s again.", focus))
	}
	return uniqueStrings(plan, 4)
}

func nextSteps(plan []string, memory *learning.MemorySummary, vocab learning.VocabularyStats) []string {
	steps := append([]string{}, plan...)
	if memory != nil && len(memory.Improving) > 0 {
		steps = append(steps, fmt.Sprintf("Repeat %s once to keep it improving.", memory.Improving[0].Title))
	}
	if len(vocab.OverusedWords) > 0 {
		steps = append(steps, fmt.Sprintf("Replace overused word %q with one alternative.", vocab.OverusedWords[0].Word))
	}
	return uniqueStrings(steps, 5)
}

func nextRecommendation(focus string, memory *learning.MemorySummary, vocab learning.VocabularyStats, progress learning.SkillProgress) string {
	if memory != nil && len(memory.TopMistakes) > 0 {
		return fmt.Sprintf("Do a short drill for %s, then record one answer using the same pattern correctly.", memory.TopMistakes[0].Title)
	}
	if len(vocab.OverusedWords) > 0 {
		return fmt.Sprintf("Try replacing %q with a stronger synonym in your next answer.", vocab.OverusedWords[0].Word)
	}
	if progress.TotalResults == 0 {
		return "Send your first practice answer so Noona can build a personal improvement plan."
	}
	return fmt.Sprintf("Record one longer answer and check whether %s improves.", focus)
}

func mistakeViews(memories []learning.MistakeMemory, limit int) []learning.MistakeView {
	out := make([]learning.MistakeView, 0, minInt(len(memories), limit))
	for _, item := range memories {
		out = append(out, learning.MistakeView{
			PatternKey:  item.PatternKey,
			Title:       item.Title,
			TotalCount:  item.TotalCount,
			RecentCount: item.RecentCount,
			Status:      item.Status,
			Message:     memoryMessage(item),
		})
		if len(out) == limit {
			break
		}
	}
	return out
}

func memoryMessage(memory learning.MistakeMemory) string {
	switch memory.Status {
	case "fixed":
		return fmt.Sprintf("%s looks fixed now.", memory.Title)
	case "improving":
		return fmt.Sprintf("%s is improving.", memory.Title)
	default:
		return fmt.Sprintf("You often repeat %s.", memory.Title)
	}
}

func skillProgress(results []learning.Result) learning.SkillProgress {
	results = sortResultsByNewest(results)
	progress := learning.SkillProgress{TotalResults: len(results)}
	if len(results) == 0 {
		return progress
	}

	totalScore := 0
	for i, result := range results {
		totalScore += result.Score
		if i == 0 {
			progress.CurrentCEFRLevel = result.CEFRLevel
			lastResultAt := result.CreatedAt
			progress.LastResultAt = &lastResultAt
		}
	}
	progress.AverageScore = totalScore / len(results)
	return progress
}

func activitySummary(streak *activityDomain.Streak, stats []*activityDomain.DailyStat) learning.ActivitySummary {
	summary := learning.ActivitySummary{ActiveDays: len(stats)}
	for _, stat := range stats {
		summary.SessionsCount += stat.SessionCount
	}
	if streak != nil {
		summary.CurrentStreak = streak.CurrentStreak
		summary.LongestStreak = streak.LongestStreak
		summary.LastActivityDate = streak.LastActivityDate
	}
	return summary
}

func recentResultInsights(results []learning.Result, limit int) []learning.ResultInsight {
	results = sortResultsByNewest(results)
	out := make([]learning.ResultInsight, 0, minInt(len(results), limit))
	for _, result := range results {
		out = append(out, learning.ResultInsight{
			ResultID:      result.ID,
			OriginalText:  result.OriginalText,
			CorrectedText: result.CorrectedText,
			Score:         result.Score,
			CEFRLevel:     result.CEFRLevel,
			CreatedAt:     result.CreatedAt,
		})
		if len(out) == limit {
			break
		}
	}
	return out
}

func sortResultsByNewest(results []learning.Result) []learning.Result {
	sorted := append([]learning.Result{}, results...)
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].CreatedAt.After(sorted[j].CreatedAt)
	})
	return sorted
}

func uniqueStrings(values []string, limit int) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, minInt(len(values), limit))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
		if len(out) == limit {
			break
		}
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
