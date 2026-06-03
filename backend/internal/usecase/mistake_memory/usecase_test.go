package mistake_memory

import (
	"context"
	"testing"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type fakeRepo struct {
	items map[string]*learning.MistakeMemory
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{items: map[string]*learning.MistakeMemory{}}
}

func (r *fakeRepo) GetByPattern(ctx context.Context, userID, patternKey string) (*learning.MistakeMemory, error) {
	item := r.items[userID+"|"+patternKey]
	if item == nil {
		return nil, nil
	}
	copy := *item
	return &copy, nil
}

func (r *fakeRepo) Create(ctx context.Context, memory *learning.MistakeMemory) error {
	memory.ID = "memory-1"
	copy := *memory
	r.items[memory.UserID+"|"+memory.PatternKey] = &copy
	return nil
}

func (r *fakeRepo) Update(ctx context.Context, memory *learning.MistakeMemory) error {
	copy := *memory
	r.items[memory.UserID+"|"+memory.PatternKey] = &copy
	return nil
}

func (r *fakeRepo) ListByUser(ctx context.Context, userID string) ([]learning.MistakeMemory, error) {
	var out []learning.MistakeMemory
	for _, item := range r.items {
		if item.UserID == userID {
			out = append(out, *item)
		}
	}
	return out, nil
}

func TestUpsertOneCreatesMemory(t *testing.T) {
	repo := newFakeRepo()
	service := NewService(repo)
	service.now = func() time.Time { return time.Date(2026, 6, 3, 10, 0, 0, 0, time.UTC) }

	memory, err := service.UpsertOne(context.Background(), "user-1", learning.Mistake{
		Type:          "grammar",
		PatternKey:    "grammar.past_simple",
		Title:         "Past Simple",
		OriginalText:  "go",
		CorrectedText: "went",
	})
	if err != nil {
		t.Fatal(err)
	}
	if memory.TotalCount != 1 || memory.RecentCount != 1 || memory.Status != "active" {
		t.Fatalf("unexpected memory counts/status: %+v", memory)
	}
}

func TestUpsertOneIncrementsRepeatedMemory(t *testing.T) {
	repo := newFakeRepo()
	service := NewService(repo)
	now := time.Date(2026, 6, 3, 10, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }

	_, err := service.UpsertOne(context.Background(), "user-1", learning.Mistake{
		Type:          "grammar",
		PatternKey:    "grammar.past_simple",
		Title:         "Past Simple",
		OriginalText:  "go",
		CorrectedText: "went",
	})
	if err != nil {
		t.Fatal(err)
	}
	memory, err := service.UpsertOne(context.Background(), "user-1", learning.Mistake{
		Type:          "grammar",
		PatternKey:    "grammar.past_simple",
		Title:         "Past Simple",
		OriginalText:  "go",
		CorrectedText: "went",
	})
	if err != nil {
		t.Fatal(err)
	}
	if memory.TotalCount != 2 || memory.RecentCount != 2 {
		t.Fatalf("expected repeated counts, got %+v", memory)
	}
}
