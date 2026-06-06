package practice

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/results"
)

type Service struct {
	stt        STTService
	storage    AudioStorage
	results    ResultService
	linguistic LinguisticService
	memory     MistakeMemoryService
	drills     DrillsService
	vocabulary VocabularyService
	daily      DailyService
	activity   ActivityService
}

func NewService(stt STTService, storage AudioStorage, results ResultService, deps ...any) *Service {
	s := &Service{stt: stt, storage: storage, results: results}
	for _, dep := range deps {
		switch v := dep.(type) {
		case LinguisticService:
			s.linguistic = v
		case MistakeMemoryService:
			s.memory = v
		case DrillsService:
			s.drills = v
		case VocabularyService:
			s.vocabulary = v
		case DailyService:
			s.daily = v
		case ActivityService:
			s.activity = v
		}
	}
	return s
}

func (s *Service) SubmitText(ctx context.Context, input TextInput) (*learning.ResultView, error) {
	return s.createFromText(ctx, createInput{
		UserID:         input.UserID,
		Text:           input.Text,
		DailySessionID: input.DailySessionID,
	})
}

func (s *Service) SubmitAudio(ctx context.Context, input AudioInput) (*learning.ResultView, error) {
	if s.stt == nil {
		return nil, fmt.Errorf("stt service is not configured")
	}
	audioBytes, err := io.ReadAll(io.LimitReader(input.File, 32<<20))
	if err != nil {
		return nil, fmt.Errorf("read audio: %w", err)
	}
	if len(audioBytes) == 0 {
		return nil, fmt.Errorf("empty audio")
	}

	audioURL := ""
	if s.storage != nil {
		filePath, err := s.storage.UploadFile(ctx, bytes.NewReader(audioBytes), int64(len(audioBytes)), input.ContentType, input.Ext)
		if err != nil {
			return nil, err
		}
		audioURL, err = s.storage.FileURL(ctx, filePath)
		if err != nil {
			return nil, err
		}
	}

	transcript, err := s.stt.TranscribeReader(ctx, bytes.NewReader(audioBytes), "en")
	if err != nil {
		return nil, err
	}
	transcript = strings.TrimSpace(transcript)
	if transcript == "" {
		return nil, fmt.Errorf("empty transcript")
	}

	return s.createFromText(ctx, createInput{
		UserID:         input.UserID,
		Text:           transcript,
		AudioURL:       audioURL,
		DailySessionID: input.DailySessionID,
	})
}

type createInput struct {
	UserID         string
	Text           string
	AudioURL       string
	DailySessionID string
}

func (s *Service) createFromText(ctx context.Context, input createInput) (*learning.ResultView, error) {
	text := strings.TrimSpace(input.Text)
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}
	if text == "" {
		return nil, fmt.Errorf("text is required")
	}

	sessionID := strings.TrimSpace(input.DailySessionID)
	if s.daily != nil {
		session, err := s.daily.EnsureSession(ctx, userID, sessionID)
		if err != nil {
			slog.Warn("practice: daily session ensure failed", "error", err, "user_id", userID)
		} else if session != nil {
			sessionID = session.ID
		}
	}

	analysis := s.analyze(ctx, text)
	mistakes := mistakesFromAnalysis(analysis, text)
	correctedText := strings.TrimSpace(analysis.Correction)
	if correctedText == "" {
		correctedText = text
	}

	vocabStats := localVocabularyStats(text)
	scores := scoreResult(text, mistakes, vocabStats)
	nextStep := nextStepFromAnalysis(analysis, mistakes)

	view, err := s.results.Create(ctx, results.CreateInput{
		UserID:             userID,
		DailySessionID:     sessionID,
		OriginalText:       text,
		CorrectedText:      correctedText,
		AudioURL:           input.AudioURL,
		Score:              scores.total,
		CEFRLevel:          normalizeCEFR(analysis.CEFRLevel),
		FluencyScore:       scores.fluency,
		GrammarScore:       scores.grammar,
		VocabularyScore:    scores.vocabulary,
		PronunciationScore: scores.pronunciation,
		Summary:            summaryFromAnalysis(analysis),
		NextStep:           nextStep,
		Mistakes:           mistakes,
		Vocabulary:         vocabStats,
	})
	if err != nil {
		return nil, err
	}

	memories := s.updateMemory(ctx, userID, view.Mistakes)
	attachMemoryMessages(view.Mistakes, memories)

	if s.vocabulary != nil {
		tracked, err := s.vocabulary.TrackTranscript(ctx, userID, view.Result.ID, view.Result.TranscriptID, text)
		if err != nil {
			slog.Warn("practice: vocabulary tracking failed", "error", err, "user_id", userID, "result_id", view.Result.ID)
		} else {
			view.Vocabulary = tracked
		}
	}

	if s.daily != nil && sessionID != "" {
		metrics := dailyMetrics(view.Result, view.Vocabulary, view.Mistakes, nextStep)
		if err := s.daily.ApplyResult(ctx, sessionID, metrics); err != nil {
			slog.Warn("practice: daily metrics update failed", "error", err, "user_id", userID, "session_id", sessionID)
		}
	}

	if s.activity != nil {
		if err := s.activity.RecordActivity(ctx, userID); err != nil {
			slog.Warn("practice: activity record failed", "error", err, "user_id", userID)
		}
	}

	if s.drills != nil && len(memories) > 0 {
		if _, err := s.drills.GenerateForMemories(ctx, userID, memories); err != nil {
			slog.Warn("practice: drill generation failed", "error", err, "user_id", userID)
		}
	}

	return view, nil
}

func (s *Service) analyze(ctx context.Context, text string) *linguistic.AIAnalysis {
	if s.linguistic == nil {
		return fallbackAnalysis(text)
	}
	analysis, err := s.linguistic.Analyze(ctx, text)
	if err != nil {
		slog.Warn("practice: linguistic analysis failed, using fallback result", "error", err)
		return fallbackAnalysis(text)
	}
	if analysis == nil {
		return fallbackAnalysis(text)
	}
	return analysis
}

func (s *Service) updateMemory(ctx context.Context, userID string, mistakes []learning.Mistake) []learning.MistakeMemory {
	if s.memory == nil || len(mistakes) == 0 {
		return nil
	}
	memories, err := s.memory.UpsertFromMistakes(ctx, userID, mistakes)
	if err != nil {
		slog.Warn("practice: mistake memory update failed", "error", err, "user_id", userID)
		return nil
	}
	return memories
}

func fallbackAnalysis(text string) *linguistic.AIAnalysis {
	return &linguistic.AIAnalysis{
		Correction:  text,
		Explanation: "Your answer is saved. Detailed feedback will be added later.",
		Mistakes:    []linguistic.AIMistake{},
		Suggested:   []string{"Try one longer sentence next time."},
	}
}

func mistakesFromAnalysis(analysis *linguistic.AIAnalysis, text string) []learning.Mistake {
	if analysis == nil || len(analysis.Mistakes) == 0 {
		return []learning.Mistake{}
	}

	mistakes := make([]learning.Mistake, 0, len(analysis.Mistakes))
	for _, item := range analysis.Mistakes {
		original := strings.TrimSpace(item.Original)
		corrected := strings.TrimSpace(item.Corrected)
		if original == "" && corrected == "" {
			continue
		}

		kind := normalizeMistakeType(item.Type)
		title := strings.TrimSpace(item.Title)
		if title == "" {
			title = titleFromMistake(kind, original, corrected)
		}
		patternKey := strings.TrimSpace(item.PatternKey)
		if patternKey == "" {
			patternKey = patternKeyFromMistake(kind, title, original, corrected)
		}
		explanation := strings.TrimSpace(item.Explanation)
		if explanation == "" {
			explanation = strings.TrimSpace(analysis.Explanation)
		}

		mistakes = append(mistakes, learning.Mistake{
			Type:          kind,
			PatternKey:    patternKey,
			Title:         title,
			OriginalText:  valueOr(original, text),
			CorrectedText: valueOr(corrected, strings.TrimSpace(analysis.Correction)),
			Explanation:   explanation,
		})
	}
	return mistakes
}

func localVocabularyStats(text string) learning.VocabularyStats {
	stats, _ := analyzeWords(text)
	return stats
}

type scoreBundle struct {
	total         int
	fluency       int
	grammar       int
	vocabulary    int
	pronunciation int
}

func scoreResult(text string, mistakes []learning.Mistake, stats learning.VocabularyStats) scoreBundle {
	words := len(strings.Fields(text))
	grammarMistakes := countMistakes(mistakes, "grammar")
	vocabularyMistakes := countMistakes(mistakes, "vocabulary")
	pronunciationMistakes := countMistakes(mistakes, "pronunciation")

	fluency := 70
	switch {
	case words == 0:
		fluency = 0
	case words < 6:
		fluency = 60
	case words <= 18:
		fluency = 82
	default:
		fluency = 88
	}

	grammar := clampScore(100 - grammarMistakes*18)
	vocabulary := clampScore(80 + minInt(stats.UniqueWords, 10)*2 - vocabularyMistakes*15)
	pronunciation := clampScore(100 - pronunciationMistakes*20)
	total := (fluency + grammar + vocabulary + pronunciation) / 4

	return scoreBundle{
		total:         total,
		fluency:       fluency,
		grammar:       grammar,
		vocabulary:    vocabulary,
		pronunciation: pronunciation,
	}
}

func dailyMetrics(result learning.Result, stats learning.VocabularyStats, mistakes []learning.Mistake, nextStep string) learning.ResultMetrics {
	return learning.ResultMetrics{
		TotalWords:          stats.TotalWords,
		UniqueWords:         stats.UniqueWords,
		NewWordsCount:       len(stats.NewWords),
		MistakesCount:       len(mistakes),
		GrammarErrors:       countMistakes(mistakes, "grammar"),
		VocabularyErrors:    countMistakes(mistakes, "vocabulary"),
		PronunciationErrors: countMistakes(mistakes, "pronunciation"),
		Score:               result.Score,
		CEFRLevel:           result.CEFRLevel,
		MainWeakPoint:       mainWeakPoint(mistakes),
		NextStep:            nextStep,
	}
}

func attachMemoryMessages(mistakes []learning.Mistake, memories []learning.MistakeMemory) {
	if len(mistakes) == 0 || len(memories) == 0 {
		return
	}
	byPattern := make(map[string]learning.MistakeMemory, len(memories))
	for _, memory := range memories {
		byPattern[memory.PatternKey] = memory
	}
	for i := range mistakes {
		memory, ok := byPattern[mistakes[i].PatternKey]
		if !ok {
			continue
		}
		if memory.TotalCount <= 1 {
			mistakes[i].MemoryMessage = "First time we noticed this pattern."
			continue
		}
		mistakes[i].MemoryMessage = fmt.Sprintf("This pattern appeared %d times.", memory.TotalCount)
	}
}

func summaryFromAnalysis(analysis *linguistic.AIAnalysis) string {
	if analysis == nil {
		return "Your answer is saved."
	}
	if summary := strings.TrimSpace(analysis.Explanation); summary != "" {
		return summary
	}
	return "Your answer is saved."
}

func nextStepFromAnalysis(analysis *linguistic.AIAnalysis, mistakes []learning.Mistake) string {
	if analysis != nil {
		for _, item := range analysis.Suggested {
			if step := strings.TrimSpace(item); step != "" {
				return step
			}
		}
	}
	if len(mistakes) > 0 {
		return fmt.Sprintf("Practice one more sentence with %s.", mistakes[0].Title)
	}
	return "Try one longer sentence next time."
}

func normalizeCEFR(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	switch value {
	case "A1", "A2", "B1", "B2", "C1", "C2":
		return value
	default:
		return ""
	}
}

func normalizeMistakeType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "grammar", "vocabulary", "pronunciation":
		return value
	default:
		return "grammar"
	}
}

func titleFromMistake(kind, original, corrected string) string {
	if original != "" && corrected != "" {
		return fmt.Sprintf("%s -> %s", original, corrected)
	}
	if original != "" {
		return original
	}
	if corrected != "" {
		return corrected
	}
	return strings.Title(kind)
}

func patternKeyFromMistake(kind, title, original, corrected string) string {
	raw := strings.ToLower(strings.TrimSpace(title))
	if raw == "" {
		raw = strings.ToLower(strings.TrimSpace(original + " " + corrected))
	}
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
	return kind + "." + raw
}

func valueOr(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return strings.TrimSpace(fallback)
}

func countMistakes(mistakes []learning.Mistake, kind string) int {
	count := 0
	for _, mistake := range mistakes {
		if strings.EqualFold(strings.TrimSpace(mistake.Type), kind) {
			count++
		}
	}
	return count
}

func mainWeakPoint(mistakes []learning.Mistake) string {
	if len(mistakes) == 0 {
		return ""
	}
	return mistakes[0].Title
}

func clampScore(value int) int {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func analyzeWords(text string) (learning.VocabularyStats, []string) {
	fields := strings.FieldsFunc(text, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r == '\'')
	})
	counts := make(map[string]int)
	words := make([]string, 0, len(fields))
	for _, field := range fields {
		word := strings.Trim(strings.ToLower(field), "'")
		if word == "" {
			continue
		}
		counts[word]++
		words = append(words, word)
	}

	repeated := make([]string, 0)
	for word, count := range counts {
		if count > 1 {
			repeated = append(repeated, word)
		}
	}
	sort.Strings(repeated)

	return learning.VocabularyStats{
		TotalWords:    len(words),
		UniqueWords:   len(counts),
		RepeatedWords: repeated,
		OverusedWords: overusedWords(counts),
	}, words
}

func overusedWords(counts map[string]int) []learning.WordSuggestion {
	alternatives := map[string][]string{
		"good": {"useful", "strong", "excellent"},
		"nice": {"pleasant", "kind", "enjoyable"},
		"very": {"really", "extremely", "especially"},
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
