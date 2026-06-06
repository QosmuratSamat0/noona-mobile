package results

import (
	"context"
	"errors"
	"testing"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type fakeRepository struct {
	createInput learning.ResultBundleInput
	createErr   error
	result      *learning.Result
	list        []learning.Result
	recent      []learning.Result
	limit       int
}

func (r *fakeRepository) CreateBundle(ctx context.Context, input learning.ResultBundleInput) (*learning.ResultBundle, error) {
	r.createInput = input
	if r.createErr != nil {
		return nil, r.createErr
	}
	return &learning.ResultBundle{
		Result: learning.Result{
			ID:                 "result-1",
			UserID:             input.UserID,
			TranscriptID:       "transcript-1",
			DailySessionID:     input.DailySessionID,
			OriginalText:       input.OriginalText,
			CorrectedText:      input.CorrectedText,
			Score:              input.Score,
			CEFRLevel:          input.CEFRLevel,
			FluencyScore:       input.FluencyScore,
			GrammarScore:       input.GrammarScore,
			VocabularyScore:    input.VocabularyScore,
			PronunciationScore: input.PronunciationScore,
			Summary:            input.Summary,
			NextStep:           input.NextStep,
		},
		Transcript: learning.Transcript{ID: "transcript-1", UserID: input.UserID, OriginalText: input.OriginalText},
	}, nil
}

func (r *fakeRepository) GetResult(ctx context.Context, userID, resultID string) (*learning.Result, error) {
	return r.result, nil
}

func (r *fakeRepository) ListResults(ctx context.Context, userID, sessionID string) ([]learning.Result, error) {
	return r.list, nil
}

func (r *fakeRepository) ListRecentResults(ctx context.Context, userID string, limit int) ([]learning.Result, error) {
	r.limit = limit
	return r.recent, nil
}

type fakeMistakesRepository struct {
	created []learning.Mistake
	byID    []learning.Mistake
}

func (r *fakeMistakesRepository) CreateForResult(ctx context.Context, userID, resultID, transcriptID string, mistakes []learning.Mistake) ([]learning.Mistake, error) {
	r.created = mistakes
	for i := range mistakes {
		mistakes[i].UserID = userID
		mistakes[i].ResultID = resultID
		mistakes[i].TranscriptID = transcriptID
	}
	return mistakes, nil
}

func (r *fakeMistakesRepository) GetByResult(ctx context.Context, userID, resultID string) ([]learning.Mistake, error) {
	return r.byID, nil
}

type fakeVocabularyReader struct {
	stats learning.VocabularyStats
}

func (r fakeVocabularyReader) GetResultStats(ctx context.Context, userID, resultID string) (learning.VocabularyStats, error) {
	return r.stats, nil
}

func TestCreatePersistsPreparedResult(t *testing.T) {
	repo := &fakeRepository{}
	mistakesRepo := &fakeMistakesRepository{}
	service := NewService(repo, Dependencies{Mistakes: mistakesRepo})

	view, err := service.Create(context.Background(), CreateInput{
		UserID:         " user-1 ",
		OriginalText:   "  I go to school yesterday.  ",
		CorrectedText:  "I went to school yesterday.",
		AudioURL:       " audio.wav ",
		DailySessionID: " session-1 ",
		Score:          90,
		CEFRLevel:      "A2",
		FluencyScore:   82,
		GrammarScore:   88,
		NextStep:       "Say one more sentence about yesterday.",
		Mistakes: []learning.Mistake{{
			Type:         "grammar",
			PatternKey:   "grammar.past_simple",
			OriginalText: "go",
		}},
		Vocabulary: learning.VocabularyStats{TotalWords: 5, UniqueWords: 5},
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if view.Result.ID != "result-1" {
		t.Fatalf("expected result id result-1, got %q", view.Result.ID)
	}
	if repo.createInput.UserID != "user-1" {
		t.Fatalf("expected trimmed user id, got %q", repo.createInput.UserID)
	}
	if repo.createInput.OriginalText != "I go to school yesterday." {
		t.Fatalf("expected trimmed original text, got %q", repo.createInput.OriginalText)
	}
	if repo.createInput.CorrectedText != "I went to school yesterday." {
		t.Fatalf("expected prepared correction, got %q", repo.createInput.CorrectedText)
	}
	if len(repo.createInput.Mistakes) != 0 {
		t.Fatalf("expected result repo not to receive mistakes, got %d", len(repo.createInput.Mistakes))
	}
	if len(mistakesRepo.created) != 1 {
		t.Fatalf("expected one mistake to be saved by mistakes repo, got %d", len(mistakesRepo.created))
	}
	if len(view.Mistakes) != 1 {
		t.Fatalf("expected one mistake in view, got %d", len(view.Mistakes))
	}
	if view.Vocabulary.TotalWords != 5 {
		t.Fatalf("expected prepared vocabulary stats, got %d total words", view.Vocabulary.TotalWords)
	}
}

func TestCreateValidatesInput(t *testing.T) {
	service := NewService(&fakeRepository{}, Dependencies{})

	if _, err := service.Create(context.Background(), CreateInput{UserID: "user-1"}); err == nil {
		t.Fatal("expected empty text error")
	}
	if _, err := service.Create(context.Background(), CreateInput{OriginalText: "hello"}); err == nil {
		t.Fatal("expected empty user id error")
	}
}

func TestCreateReturnsRepositoryError(t *testing.T) {
	expected := errors.New("create failed")
	service := NewService(&fakeRepository{createErr: expected}, Dependencies{})

	if _, err := service.Create(context.Background(), CreateInput{UserID: "user-1", OriginalText: "hello"}); !errors.Is(err, expected) {
		t.Fatalf("expected repository error, got %v", err)
	}
}

func TestGetReturnsNilWhenResultNotFound(t *testing.T) {
	service := NewService(&fakeRepository{}, Dependencies{})

	view, err := service.Get(context.Background(), "user-1", "missing")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if view != nil {
		t.Fatalf("expected nil view, got %#v", view)
	}
}

func TestListRecentUsesRepositoryLimit(t *testing.T) {
	repo := &fakeRepository{recent: []learning.Result{{ID: "result-1"}}}
	service := NewService(repo, Dependencies{})

	results, err := service.ListRecent(context.Background(), "user-1", 10)
	if err != nil {
		t.Fatalf("ListRecent returned error: %v", err)
	}
	if repo.limit != 10 {
		t.Fatalf("expected repository limit 10, got %d", repo.limit)
	}
	if len(results) != 1 || results[0].ID != "result-1" {
		t.Fatalf("unexpected recent results: %#v", results)
	}
}
