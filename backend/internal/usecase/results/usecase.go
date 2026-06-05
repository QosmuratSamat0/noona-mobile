package results

import (
	"context"
	"fmt"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	linguisticDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type Service struct {
	repo       Repository
	llm        LLMProvider
	memory     MemoryService
	drills     DrillService
	vocabulary VocabularyService
	daily      DailyService
	activity   ActivityService
}

func NewService(repo Repository, llm LLMProvider, memory MemoryService, drills DrillService, vocabulary VocabularyService, daily DailyService, activity ActivityService) *Service {
	return &Service{
		repo:       repo,
		llm:        llm,
		memory:     memory,
		drills:     drills,
		vocabulary: vocabulary,
		daily:      daily,
		activity:   activity,
	}
}

func (s *Service) CreateFromText(ctx context.Context, input CreateInput) (*learning.ResultView, error) {
	text := strings.TrimSpace(input.Text)
	if text == "" {
		return nil, fmt.Errorf("text is required")
	}
	if s.llm == nil {
		return nil, fmt.Errorf("linguistic analysis provider is not configured")
	}

	session, err := s.daily.EnsureSession(ctx, input.UserID, input.DailySessionID)
	if err != nil {
		return nil, err
	}

	analysis, err := s.llm.Analyze(ctx, text)
	if err != nil {
		return nil, err
	}

	corrected := strings.TrimSpace(analysis.Correction)
	if corrected == "" {
		corrected = text
	}
	mistakes := toMistakes(input.UserID, analysis)
	scores := scoreFromAnalysis(text, mistakes)
	nextSteps := nextStepsFrom(analysis, mistakes, scores)

	bundle, err := s.repo.CreateBundle(ctx, learning.ResultBundleInput{
		UserID:             input.UserID,
		DailySessionID:     session.ID,
		OriginalText:       text,
		CorrectedText:      corrected,
		AudioURL:           strings.TrimSpace(input.AudioURL),
		Score:              scores.overall,
		CEFRLevel:          analysis.CEFRLevel,
		FluencyScore:       scores.fluency,
		GrammarScore:       scores.grammar,
		VocabularyScore:    scores.vocabulary,
		PronunciationScore: scores.pronunciation,
		Summary:            strings.TrimSpace(analysis.Explanation),
		NextStep:           strings.Join(nextSteps, " "),
		Mistakes:           mistakes,
	})
	if err != nil {
		return nil, err
	}

	memories, err := s.memory.UpsertFromMistakes(ctx, input.UserID, bundle.Mistakes)
	if err != nil {
		return nil, err
	}
	addMemoryMessages(bundle.Mistakes, memories)

	vocabStats, err := s.vocabulary.TrackTranscript(ctx, input.UserID, bundle.Result.ID, bundle.Transcript.ID, text)
	if err != nil {
		return nil, err
	}

	metrics := metricsFor(vocabStats, bundle.Mistakes, bundle.Result, memories)
	if err := s.daily.ApplyResult(ctx, session.ID, metrics); err != nil {
		return nil, err
	}
	if s.activity != nil {
		_ = s.activity.RecordActivity(ctx, input.UserID)
	}
	if _, err := s.drills.GenerateForMemories(ctx, input.UserID, memories); err != nil {
		return nil, err
	}

	return &learning.ResultView{
		Result:          bundle.Result,
		Mistakes:        bundle.Mistakes,
		Vocabulary:      vocabStats,
		SpeakingQuality: speakingQuality(bundle.Result.FluencyScore, vocabStats.TotalWords),
		NextSteps:       nextSteps,
	}, nil
}

func (s *Service) Get(ctx context.Context, userID, resultID string) (*learning.ResultView, error) {
	result, err := s.repo.GetResult(ctx, userID, resultID)
	if err != nil {
		return nil, err
	}
	mistakes, err := s.repo.GetMistakesByResult(ctx, userID, resultID)
	if err != nil {
		return nil, err
	}
	vocab, err := s.vocabulary.GetToday(ctx, userID)
	if err != nil {
		return nil, err
	}
	nextSteps := splitNextSteps(result.NextStep)
	return &learning.ResultView{
		Result:          *result,
		Mistakes:        mistakes,
		Vocabulary:      vocab,
		SpeakingQuality: speakingQuality(result.FluencyScore, len(strings.Fields(result.OriginalText))),
		NextSteps:       nextSteps,
	}, nil
}

func (s *Service) List(ctx context.Context, userID, sessionID string) ([]learning.Result, error) {
	return s.repo.ListResults(ctx, userID, sessionID)
}

func scoreFromAnalysis(text string, mistakes []learning.Mistake) scores {
	words := len(strings.Fields(text))
	grammarMistakes, vocabularyMistakes, pronunciationMistakes := countMistakeTypes(mistakes)
	grammar := clampScore(100 - grammarMistakes*12)
	vocab := clampScore(100 - vocabularyMistakes*10)
	pronunciation := clampScore(100 - pronunciationMistakes*10)
	fluency := clampScore(55 + min(words, 25))
	overall := (grammar + vocab + pronunciation + fluency) / 4
	return scores{overall: overall, fluency: fluency, grammar: grammar, vocabulary: vocab, pronunciation: pronunciation}
}

func toMistakes(userID string, analysis *linguisticDomain.AIAnalysis) []learning.Mistake {
	mistakes := make([]learning.Mistake, 0, len(analysis.Mistakes))
	for _, m := range analysis.Mistakes {
		mistake := learning.Mistake{
			UserID:        userID,
			Type:          normalizeType(m.Type),
			PatternKey:    strings.TrimSpace(m.PatternKey),
			Title:         strings.TrimSpace(m.Title),
			OriginalText:  strings.TrimSpace(m.Original),
			CorrectedText: strings.TrimSpace(m.Corrected),
			Explanation:   strings.TrimSpace(m.Explanation),
		}
		if mistake.Explanation == "" {
			mistake.Explanation = strings.TrimSpace(analysis.Explanation)
		}
		if mistake.PatternKey == "" {
			mistake.PatternKey = fallbackPatternKey(mistake)
		}
		if mistake.Title == "" {
			mistake.Title = fallbackTitle(mistake.PatternKey)
		}
		mistakes = append(mistakes, mistake)
	}
	return mistakes
}

func nextStepsFrom(analysis *linguisticDomain.AIAnalysis, mistakes []learning.Mistake, scores scores) []string {
	steps := make([]string, 0, 3)
	if len(mistakes) > 0 {
		steps = append(steps, "Practice 5 "+mistakes[0].Title+" sentences.")
	}
	if scores.fluency < 75 {
		steps = append(steps, "Try to make your answer longer.")
	}
	if len(analysis.Suggested) > 0 {
		steps = append(steps, analysis.Suggested[0])
	}
	if len(steps) == 0 {
		steps = append(steps, "Use 2 new words next time.")
	}
	return steps
}

func metricsFor(vocab learning.VocabularyStats, mistakes []learning.Mistake, result learning.Result, memories []learning.MistakeMemory) daily.ResultMetrics {
	grammar, vocabulary, pronunciation := countMistakeTypes(mistakes)
	weak := ""
	if len(memories) > 0 {
		weak = memories[0].Title
	}
	return daily.ResultMetrics{
		TotalWords:          vocab.TotalWords,
		UniqueWords:         vocab.UniqueWords,
		NewWordsCount:       len(vocab.NewWords),
		MistakesCount:       len(mistakes),
		GrammarErrors:       grammar,
		VocabularyErrors:    vocabulary,
		PronunciationErrors: pronunciation,
		Score:               result.Score,
		CEFRLevel:           result.CEFRLevel,
		MainWeakPoint:       weak,
		NextStep:            result.NextStep,
	}
}

func addMemoryMessages(mistakes []learning.Mistake, memories []learning.MistakeMemory) {
	byPattern := make(map[string]learning.MistakeMemory)
	for _, memory := range memories {
		byPattern[memory.PatternKey] = memory
	}
	for i := range mistakes {
		if memory, ok := byPattern[mistakes[i].PatternKey]; ok && memory.TotalCount > 1 {
			mistakes[i].MemoryMessage = fmt.Sprintf("You made this %s mistake %d times before.", memory.Title, memory.TotalCount-1)
		}
	}
}

func speakingQuality(score, totalWords int) learning.SpeakingQuality {
	length := "medium"
	message := "Your answer is understandable. Add one more detail next time."
	if totalWords < 10 {
		length = "short"
		message = "Your answer is understandable, but you need more details."
	} else if totalWords > 35 {
		length = "long"
		message = "Good detail. Keep your sentences clear and controlled."
	}
	return learning.SpeakingQuality{FluencyScore: score, AnswerLength: length, Message: message}
}

func countMistakeTypes(mistakes []learning.Mistake) (grammar, vocabulary, pronunciation int) {
	for _, mistake := range mistakes {
		switch normalizeType(mistake.Type) {
		case "vocabulary":
			vocabulary++
		case "pronunciation":
			pronunciation++
		default:
			grammar++
		}
	}
	return
}

func fallbackPatternKey(m learning.Mistake) string {
	base := strings.ToLower(strings.TrimSpace(m.Title))
	if base == "" {
		base = strings.TrimSpace(m.OriginalText + " " + m.CorrectedText)
	}
	base = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			return r
		}
		return '_'
	}, strings.ToLower(base))
	base = strings.Trim(base, "_")
	if base == "" {
		base = "general"
	}
	return normalizeType(m.Type) + "." + base
}

func fallbackTitle(patternKey string) string {
	parts := strings.Split(patternKey, ".")
	title := strings.ReplaceAll(parts[len(parts)-1], "_", " ")
	if title == "" || title == "general" {
		return "English pattern"
	}
	return strings.Title(title)
}

func normalizeType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "grammar", "vocabulary", "pronunciation":
		return value
	default:
		return "grammar"
	}
}

func splitNextSteps(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return []string{}
	}
	return []string{value}
}

func clampScore(value int) int {
	if value < 35 {
		return 35
	}
	if value > 100 {
		return 100
	}
	return value
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
