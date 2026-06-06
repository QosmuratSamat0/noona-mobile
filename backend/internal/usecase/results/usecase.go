package results

import (
	"context"
	"fmt"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Service struct {
	repo       Repository
	mistakes   MistakesRepository
	vocabulary VocabularyReader
}

type Dependencies struct {
	Mistakes   MistakesRepository
	Vocabulary VocabularyReader
}

func NewService(repo Repository, deps Dependencies) *Service {
	return &Service{
		repo:       repo,
		mistakes:   deps.Mistakes,
		vocabulary: deps.Vocabulary,
	}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*learning.ResultView, error) {
	userID := strings.TrimSpace(input.UserID)
	originalText := strings.TrimSpace(input.OriginalText)
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}
	if originalText == "" {
		return nil, fmt.Errorf("text is required")
	}

	correctedText := strings.TrimSpace(input.CorrectedText)
	if correctedText == "" {
		correctedText = originalText
	}

	bundle, err := s.repo.CreateBundle(ctx, learning.ResultBundleInput{
		UserID:             userID,
		DailySessionID:     strings.TrimSpace(input.DailySessionID),
		OriginalText:       originalText,
		CorrectedText:      correctedText,
		AudioURL:           strings.TrimSpace(input.AudioURL),
		Score:              input.Score,
		CEFRLevel:          input.CEFRLevel,
		FluencyScore:       input.FluencyScore,
		GrammarScore:       input.GrammarScore,
		VocabularyScore:    input.VocabularyScore,
		PronunciationScore: input.PronunciationScore,
		Summary:            strings.TrimSpace(input.Summary),
		NextStep:           strings.TrimSpace(input.NextStep),
	})
	if err != nil {
		return nil, err
	}

	if s.mistakes != nil && len(input.Mistakes) > 0 {
		bundle.Mistakes, err = s.mistakes.CreateForResult(ctx, userID, bundle.Result.ID, bundle.Transcript.ID, input.Mistakes)
		if err != nil {
			return nil, err
		}
	}

	view := resultView(bundle.Result)
	view.Mistakes = bundle.Mistakes
	view.Vocabulary = input.Vocabulary
	return view, nil
}

func (s *Service) Get(ctx context.Context, userID, resultID string) (*learning.ResultView, error) {
	result, err := s.repo.GetResult(ctx, userID, resultID)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, nil
	}

	view := resultView(*result)
	if s.mistakes != nil {
		mistakes, err := s.mistakes.GetByResult(ctx, userID, resultID)
		if err != nil {
			return nil, err
		}
		view.Mistakes = mistakes
	}

	if s.vocabulary != nil {
		stats, err := s.vocabulary.GetResultStats(ctx, userID, resultID)
		if err != nil {
			return nil, err
		}
		view.Vocabulary = stats
	}

	return view, nil
}

func (s *Service) List(ctx context.Context, userID, sessionID string) ([]learning.Result, error) {
	return s.repo.ListResults(ctx, userID, sessionID)
}

func (s *Service) ListRecent(ctx context.Context, userID string, limit int) ([]learning.Result, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.ListRecentResults(ctx, userID, limit)
}

func resultView(result learning.Result) *learning.ResultView {
	return &learning.ResultView{
		Result:          result,
		SpeakingQuality: speakingQuality(result.FluencyScore, len(strings.Fields(result.OriginalText))),
		NextSteps:       splitNextSteps(result.NextStep),
	}
}

func speakingQuality(score, totalWords int) learning.SpeakingQuality {
	length := "medium"
	message := "Your answer is saved. Detailed feedback will be added later."
	if totalWords < 10 {
		length = "short"
	} else if totalWords > 35 {
		length = "long"
	}
	if score >= 80 {
		message = "Strong answer. Keep adding detail and variety."
	} else if score >= 60 {
		message = "Good start. One clearer sentence will improve this."
	}
	return learning.SpeakingQuality{FluencyScore: score, AnswerLength: length, Message: message}
}

func splitNextSteps(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return []string{}
	}
	return []string{value}
}
