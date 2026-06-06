package analysis

import (
	"context"
	"testing"
	"time"

	activityDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type fakeMemoryReader struct {
	summary *learning.MemorySummary
}

func (f fakeMemoryReader) ListSummary(ctx context.Context, userID string) (*learning.MemorySummary, error) {
	return f.summary, nil
}

type fakeVocabularyReader struct {
	stats learning.VocabularyStats
}

func (f fakeVocabularyReader) GetToday(ctx context.Context, userID string) (learning.VocabularyStats, error) {
	return f.stats, nil
}

type fakeDailyReader struct {
	session *learning.DailySession
}

func (f fakeDailyReader) Today(ctx context.Context, userID string) (*learning.DailySession, error) {
	return f.session, nil
}

type fakeResultsReader struct {
	results []learning.Result
	limit   int
}

func (f *fakeResultsReader) ListRecent(ctx context.Context, userID string, limit int) ([]learning.Result, error) {
	f.limit = limit
	return f.results, nil
}

type fakeActivityReader struct {
	streak *activityDomain.Streak
	stats  []*activityDomain.DailyStat
}

func (f fakeActivityReader) GetActivity(ctx context.Context, userID string) (*activityDomain.Streak, []*activityDomain.DailyStat, error) {
	return f.streak, f.stats, nil
}

func TestGetMineAggregatesReadModels(t *testing.T) {
	now := time.Now()
	results := &fakeResultsReader{results: []learning.Result{
		{ID: "result-1", Score: 70, CEFRLevel: "A1", CreatedAt: now.Add(-time.Hour)},
		{ID: "result-2", Score: 90, CEFRLevel: "A2", CreatedAt: now},
	}}
	service := NewService(
		fakeMemoryReader{summary: &learning.MemorySummary{
			TopMistakes: []learning.MistakeMemory{{
				PatternKey:  "grammar.past_simple",
				Title:       "Past Simple",
				TotalCount:  6,
				RecentCount: 2,
				Status:      "active",
			}},
			Fixed: []learning.MistakeMemory{{
				PatternKey:  "grammar.articles",
				Title:       "Articles",
				TotalCount:  4,
				RecentCount: 0,
				Status:      "fixed",
			}},
		}},
		fakeVocabularyReader{stats: learning.VocabularyStats{
			TotalWords:  20,
			UniqueWords: 12,
			NewWords:    []string{"campus"},
		}},
		fakeDailyReader{session: &learning.DailySession{ID: "session-1", TotalResults: 1}},
		Dependencies{
			Results: results,
			Activity: fakeActivityReader{
				streak: &activityDomain.Streak{CurrentStreak: 3, LongestStreak: 5, LastActivityDate: &now},
				stats:  []*activityDomain.DailyStat{{SessionCount: 2}, {SessionCount: 1}},
			},
		},
	)

	summary, err := service.GetMine(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("GetMine returned error: %v", err)
	}
	if summary.Focus != "Past Simple" {
		t.Fatalf("expected focus Past Simple, got %q", summary.Focus)
	}
	if len(summary.TopMistakes) != 1 {
		t.Fatalf("expected one top mistake, got %d", len(summary.TopMistakes))
	}
	if len(summary.FixedMistakes) != 1 {
		t.Fatalf("expected one fixed mistake, got %d", len(summary.FixedMistakes))
	}
	if summary.SkillProgress.TotalResults != 2 {
		t.Fatalf("expected two results, got %d", summary.SkillProgress.TotalResults)
	}
	if summary.SkillProgress.AverageScore != 80 {
		t.Fatalf("expected average score 80, got %d", summary.SkillProgress.AverageScore)
	}
	if summary.SkillProgress.CurrentCEFRLevel != "A2" {
		t.Fatalf("expected newest CEFR level A2, got %q", summary.SkillProgress.CurrentCEFRLevel)
	}
	if summary.Activity.CurrentStreak != 3 || summary.Activity.SessionsCount != 3 {
		t.Fatalf("unexpected activity summary: %#v", summary.Activity)
	}
	if len(summary.RecentResults) != 2 {
		t.Fatalf("expected two recent results, got %d", len(summary.RecentResults))
	}
	if summary.RecentResults[0].ResultID != "result-2" {
		t.Fatalf("expected newest recent result first, got %q", summary.RecentResults[0].ResultID)
	}
	if results.limit != 20 {
		t.Fatalf("expected ListRecent limit 20, got %d", results.limit)
	}
	if summary.NextRecommendation == "" {
		t.Fatal("expected next recommendation")
	}
}

func TestGetMineHandlesNilMemorySummary(t *testing.T) {
	service := NewService(
		fakeMemoryReader{},
		fakeVocabularyReader{},
		fakeDailyReader{},
		Dependencies{},
	)

	summary, err := service.GetMine(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("GetMine returned error: %v", err)
	}
	if len(summary.TopMistakes) != 0 {
		t.Fatalf("expected no top mistakes, got %d", len(summary.TopMistakes))
	}
	if summary.Focus == "" {
		t.Fatal("expected fallback focus")
	}
}
