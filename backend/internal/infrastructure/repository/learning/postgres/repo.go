package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/daily"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PostgresRepo {
	return &PostgresRepo{db: db}
}

func (r *PostgresRepo) CreateBundle(ctx context.Context, input learning.ResultBundleInput) (*learning.ResultBundle, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var bundle learning.ResultBundle
	if err := tx.QueryRow(ctx, `
		INSERT INTO transcripts (user_id, raw_text, original_text, audio_url)
		VALUES ($1, $2, $2, $3)
		RETURNING id, user_id, original_text, COALESCE(audio_url, ''), created_at
	`, input.UserID, input.OriginalText, nullString(input.AudioURL)).Scan(
		&bundle.Transcript.ID,
		&bundle.Transcript.UserID,
		&bundle.Transcript.OriginalText,
		&bundle.Transcript.AudioURL,
		&bundle.Transcript.CreatedAt,
	); err != nil {
		return nil, err
	}

	var dailySessionID any
	if strings.TrimSpace(input.DailySessionID) != "" {
		dailySessionID = input.DailySessionID
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO results (
			user_id, transcript_id, daily_session_id, original_text, corrected_text,
			score, cefr_level, fluency_score, grammar_score, vocabulary_score,
			pronunciation_score, summary, next_step
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, user_id, transcript_id, COALESCE(daily_session_id::text, ''),
			original_text, corrected_text, score, COALESCE(cefr_level, ''),
			fluency_score, grammar_score, vocabulary_score, pronunciation_score,
			COALESCE(summary, ''), COALESCE(next_step, ''), created_at
	`, input.UserID, bundle.Transcript.ID, dailySessionID, input.OriginalText, input.CorrectedText,
		input.Score, nullString(input.CEFRLevel), input.FluencyScore, input.GrammarScore, input.VocabularyScore,
		input.PronunciationScore, nullString(input.Summary), nullString(input.NextStep)).Scan(
		&bundle.Result.ID,
		&bundle.Result.UserID,
		&bundle.Result.TranscriptID,
		&bundle.Result.DailySessionID,
		&bundle.Result.OriginalText,
		&bundle.Result.CorrectedText,
		&bundle.Result.Score,
		&bundle.Result.CEFRLevel,
		&bundle.Result.FluencyScore,
		&bundle.Result.GrammarScore,
		&bundle.Result.VocabularyScore,
		&bundle.Result.PronunciationScore,
		&bundle.Result.Summary,
		&bundle.Result.NextStep,
		&bundle.Result.CreatedAt,
	); err != nil {
		return nil, err
	}

	for _, mistake := range input.Mistakes {
		mistake.UserID = input.UserID
		mistake.ResultID = bundle.Result.ID
		mistake.TranscriptID = bundle.Transcript.ID
		if err := tx.QueryRow(ctx, `
			INSERT INTO mistakes (
				user_id, result_id, transcript_id, type, pattern_key, title,
				original_text, corrected_text, explanation, original, corrected, offset_pos
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7, $8, 0)
			RETURNING id, created_at
		`, mistake.UserID, mistake.ResultID, mistake.TranscriptID, mistake.Type, mistake.PatternKey,
			mistake.Title, mistake.OriginalText, mistake.CorrectedText, nullString(mistake.Explanation)).Scan(&mistake.ID, &mistake.CreatedAt); err != nil {
			return nil, err
		}
		bundle.Mistakes = append(bundle.Mistakes, mistake)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &bundle, nil
}

func (r *PostgresRepo) GetResult(ctx context.Context, userID, resultID string) (*learning.Result, error) {
	result := &learning.Result{}
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, transcript_id, COALESCE(daily_session_id::text, ''),
			original_text, corrected_text, score, COALESCE(cefr_level, ''),
			fluency_score, grammar_score, vocabulary_score, pronunciation_score,
			COALESCE(summary, ''), COALESCE(next_step, ''), created_at
		FROM results
		WHERE user_id = $1 AND id = $2
	`, userID, resultID).Scan(
		&result.ID, &result.UserID, &result.TranscriptID, &result.DailySessionID,
		&result.OriginalText, &result.CorrectedText, &result.Score, &result.CEFRLevel,
		&result.FluencyScore, &result.GrammarScore, &result.VocabularyScore, &result.PronunciationScore,
		&result.Summary, &result.NextStep, &result.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return result, err
}

func (r *PostgresRepo) GetMistakesByResult(ctx context.Context, userID, resultID string) ([]learning.Mistake, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, COALESCE(result_id::text, ''), COALESCE(transcript_id::text, ''),
			type, COALESCE(pattern_key, ''), COALESCE(title, ''),
			COALESCE(original_text, original), COALESCE(corrected_text, corrected),
			COALESCE(explanation, ''), created_at
		FROM mistakes
		WHERE user_id = $1 AND result_id = $2
		ORDER BY created_at
	`, userID, resultID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMistakes(rows)
}

func (r *PostgresRepo) ListResults(ctx context.Context, userID, sessionID string) ([]learning.Result, error) {
	query := `
		SELECT id, user_id, transcript_id, COALESCE(daily_session_id::text, ''),
			original_text, corrected_text, score, COALESCE(cefr_level, ''),
			fluency_score, grammar_score, vocabulary_score, pronunciation_score,
			COALESCE(summary, ''), COALESCE(next_step, ''), created_at
		FROM results
		WHERE user_id = $1`
	args := []any{userID}
	if strings.TrimSpace(sessionID) != "" {
		query += " AND daily_session_id = $2"
		args = append(args, sessionID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]learning.Result, 0)
	for rows.Next() {
		var result learning.Result
		if err := rows.Scan(
			&result.ID, &result.UserID, &result.TranscriptID, &result.DailySessionID,
			&result.OriginalText, &result.CorrectedText, &result.Score, &result.CEFRLevel,
			&result.FluencyScore, &result.GrammarScore, &result.VocabularyScore, &result.PronunciationScore,
			&result.Summary, &result.NextStep, &result.CreatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, result)
	}
	return results, rows.Err()
}

func (r *PostgresRepo) GetByPattern(ctx context.Context, userID, patternKey string) (*learning.MistakeMemory, error) {
	memory := &learning.MistakeMemory{}
	err := r.db.QueryRow(ctx, memorySelect()+` WHERE user_id = $1 AND pattern_key = $2`, userID, patternKey).Scan(memoryScan(memory)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return memory, err
}

func (r *PostgresRepo) Create(ctx context.Context, memory *learning.MistakeMemory) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO mistake_memory (
			user_id, pattern_key, type, title, description, total_count, recent_count,
			first_seen_at, last_seen_at, status, last_original_text, last_corrected_text, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id
	`, memory.UserID, memory.PatternKey, memory.Type, memory.Title, nullString(memory.Description),
		memory.TotalCount, memory.RecentCount, memory.FirstSeenAt, memory.LastSeenAt, memory.Status,
		nullString(memory.LastOriginalText), nullString(memory.LastCorrectedText), memory.UpdatedAt).Scan(&memory.ID)
}

func (r *PostgresRepo) Update(ctx context.Context, memory *learning.MistakeMemory) error {
	_, err := r.db.Exec(ctx, `
		UPDATE mistake_memory
		SET type = $3, title = $4, description = $5, total_count = $6, recent_count = $7,
			last_seen_at = $8, status = $9, last_original_text = $10,
			last_corrected_text = $11, updated_at = $12
		WHERE user_id = $1 AND pattern_key = $2
	`, memory.UserID, memory.PatternKey, memory.Type, memory.Title, nullString(memory.Description),
		memory.TotalCount, memory.RecentCount, memory.LastSeenAt, memory.Status,
		nullString(memory.LastOriginalText), nullString(memory.LastCorrectedText), memory.UpdatedAt)
	return err
}

func (r *PostgresRepo) ListByUser(ctx context.Context, userID string) ([]learning.MistakeMemory, error) {
	rows, err := r.db.Query(ctx, memorySelect()+` WHERE user_id = $1 ORDER BY total_count DESC, last_seen_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memories := make([]learning.MistakeMemory, 0)
	for rows.Next() {
		var memory learning.MistakeMemory
		if err := rows.Scan(memoryScan(&memory)...); err != nil {
			return nil, err
		}
		memories = append(memories, memory)
	}
	return memories, rows.Err()
}

func (r *PostgresRepo) HasPendingForPattern(ctx context.Context, userID, patternKey string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM practice_drills
			WHERE user_id = $1 AND pattern_key = $2 AND status = 'pending'
		)
	`, userID, patternKey).Scan(&exists)
	return exists, err
}

func (r *PostgresRepo) CreateDrill(ctx context.Context, drill *learning.Drill) error {
	var memoryID any
	if strings.TrimSpace(drill.MistakeMemoryID) != "" {
		memoryID = drill.MistakeMemoryID
	}
	var dueDate any
	if drill.DueDate != nil {
		dueDate = *drill.DueDate
	}
	return r.db.QueryRow(ctx, `
		INSERT INTO practice_drills (user_id, mistake_memory_id, pattern_key, title, instruction, status, due_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`, drill.UserID, memoryID, drill.PatternKey, drill.Title, drill.Instruction, drill.Status, dueDate).Scan(&drill.ID, &drill.CreatedAt)
}

func (r *PostgresRepo) ListDrillsByUser(ctx context.Context, userID string) ([]learning.Drill, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, COALESCE(mistake_memory_id::text, ''), pattern_key, title,
			instruction, status, due_date, completed_at, created_at
		FROM practice_drills
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	drills := make([]learning.Drill, 0)
	for rows.Next() {
		var drill learning.Drill
		var due sql.NullTime
		var completed sql.NullTime
		if err := rows.Scan(&drill.ID, &drill.UserID, &drill.MistakeMemoryID, &drill.PatternKey,
			&drill.Title, &drill.Instruction, &drill.Status, &due, &completed, &drill.CreatedAt); err != nil {
			return nil, err
		}
		if due.Valid {
			drill.DueDate = &due.Time
		}
		if completed.Valid {
			drill.CompletedAt = &completed.Time
		}
		drills = append(drills, drill)
	}
	return drills, rows.Err()
}

func (r *PostgresRepo) TrackWords(ctx context.Context, userID, resultID, transcriptID string, words []learning.WordUsage) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	seenNew := make(map[string]bool)
	for _, word := range words {
		if word.Normalized == "" {
			continue
		}
		var existingID string
		err := tx.QueryRow(ctx, `SELECT id FROM user_words WHERE user_id = $1 AND normalized_word = $2`, userID, word.Normalized).Scan(&existingID)
		isNew := false
		if errors.Is(err, pgx.ErrNoRows) {
			isNew = !seenNew[word.Normalized]
			seenNew[word.Normalized] = true
			if err := tx.QueryRow(ctx, `
				INSERT INTO user_words (user_id, word, normalized_word, usage_count)
				VALUES ($1, $2, $3, 1)
				RETURNING id
			`, userID, word.Word, word.Normalized).Scan(&existingID); err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else {
			if _, err := tx.Exec(ctx, `
				UPDATE user_words
				SET usage_count = usage_count + 1, last_used_at = now(), word = $3
				WHERE user_id = $1 AND normalized_word = $2
			`, userID, word.Normalized, word.Word); err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO word_usage_events (user_id, result_id, transcript_id, word, normalized_word, is_new)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, userID, resultID, transcriptID, word.Word, word.Normalized, isNew)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *PostgresRepo) GetResultStats(ctx context.Context, userID, resultID string) (learning.VocabularyStats, error) {
	return r.wordStats(ctx, `user_id = $1 AND result_id = $2`, userID, resultID)
}

func (r *PostgresRepo) GetTodayStats(ctx context.Context, userID string) (learning.VocabularyStats, error) {
	return r.wordStats(ctx, `user_id = $1 AND created_at::date = CURRENT_DATE`, userID)
}

func (r *PostgresRepo) StartSession(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO daily_sessions (user_id, date, started_at)
		VALUES ($1, $2, now())
		RETURNING id, user_id, date, started_at, ended_at, duration_seconds, total_results,
			total_words, unique_words, new_words_count, mistakes_count, grammar_errors,
			vocabulary_errors, pronunciation_errors, avg_score, COALESCE(cefr_level, ''),
			COALESCE(main_weak_point, ''), COALESCE(summary, ''), COALESCE(next_step, '')
	`, userID, date.Format("2006-01-02")).Scan(sessionScan(session)...)
	return session, err
}

func (r *PostgresRepo) FinishSession(ctx context.Context, userID, sessionID string, endedAt time.Time) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, `
		UPDATE daily_sessions
		SET ended_at = $3, duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM ($3 - started_at))::int)
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, date, started_at, ended_at, duration_seconds, total_results,
			total_words, unique_words, new_words_count, mistakes_count, grammar_errors,
			vocabulary_errors, pronunciation_errors, avg_score, COALESCE(cefr_level, ''),
			COALESCE(main_weak_point, ''), COALESCE(summary, ''), COALESCE(next_step, '')
	`, userID, sessionID, endedAt).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *PostgresRepo) GetSession(ctx context.Context, userID, sessionID string) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, sessionSelect()+` WHERE user_id = $1 AND id = $2`, userID, sessionID).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *PostgresRepo) GetByDate(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, sessionSelect()+` WHERE user_id = $1 AND date = $2 ORDER BY started_at DESC LIMIT 1`, userID, date.Format("2006-01-02")).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *PostgresRepo) GetTodayOpenSession(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, sessionSelect()+` WHERE user_id = $1 AND date = $2 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`, userID, date.Format("2006-01-02")).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *PostgresRepo) UpdateAfterResult(ctx context.Context, sessionID string, metrics daily.ResultMetrics) error {
	summary := dailySummary(metrics)
	_, err := r.db.Exec(ctx, `
		UPDATE daily_sessions
		SET total_results = total_results + 1,
			total_words = total_words + $2,
			unique_words = unique_words + $3,
			new_words_count = new_words_count + $4,
			mistakes_count = mistakes_count + $5,
			grammar_errors = grammar_errors + $6,
			vocabulary_errors = vocabulary_errors + $7,
			pronunciation_errors = pronunciation_errors + $8,
			avg_score = CASE
				WHEN total_results = 0 THEN $9
				ELSE ((avg_score * total_results) + $9) / (total_results + 1)
			END,
			cefr_level = COALESCE($10, cefr_level),
			main_weak_point = COALESCE($11, main_weak_point),
			summary = $12,
			next_step = COALESCE($13, next_step)
		WHERE id = $1
	`, sessionID, metrics.TotalWords, metrics.UniqueWords, metrics.NewWordsCount, metrics.MistakesCount,
		metrics.GrammarErrors, metrics.VocabularyErrors, metrics.PronunciationErrors, metrics.Score,
		nullString(metrics.CEFRLevel), nullString(metrics.MainWeakPoint), summary, nullString(metrics.NextStep))
	return err
}

func (r *PostgresRepo) wordStats(ctx context.Context, where string, args ...any) (learning.VocabularyStats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT word, normalized_word, is_new
		FROM word_usage_events
		WHERE `+where, args...)
	if err != nil {
		return learning.VocabularyStats{}, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	display := make(map[string]string)
	newWords := make(map[string]struct{})
	total := 0
	for rows.Next() {
		var word, normalized string
		var isNew bool
		if err := rows.Scan(&word, &normalized, &isNew); err != nil {
			return learning.VocabularyStats{}, err
		}
		total++
		counts[normalized]++
		if display[normalized] == "" {
			display[normalized] = word
		}
		if isNew {
			newWords[normalized] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return learning.VocabularyStats{}, err
	}

	stats := learning.VocabularyStats{TotalWords: total, UniqueWords: len(counts)}
	for word := range newWords {
		stats.NewWords = append(stats.NewWords, display[word])
	}
	for word, count := range counts {
		if count > 1 {
			stats.RepeatedWords = append(stats.RepeatedWords, display[word])
		}
	}
	sort.Strings(stats.NewWords)
	sort.Strings(stats.RepeatedWords)
	stats.OverusedWords = overused(counts)
	return stats, nil
}

func scanMistakes(rows pgx.Rows) ([]learning.Mistake, error) {
	mistakes := make([]learning.Mistake, 0)
	for rows.Next() {
		var mistake learning.Mistake
		if err := rows.Scan(&mistake.ID, &mistake.UserID, &mistake.ResultID, &mistake.TranscriptID,
			&mistake.Type, &mistake.PatternKey, &mistake.Title, &mistake.OriginalText,
			&mistake.CorrectedText, &mistake.Explanation, &mistake.CreatedAt); err != nil {
			return nil, err
		}
		mistakes = append(mistakes, mistake)
	}
	return mistakes, rows.Err()
}

func memorySelect() string {
	return `SELECT id, user_id, pattern_key, type, title, COALESCE(description, ''),
		total_count, recent_count, first_seen_at, last_seen_at, status,
		COALESCE(last_original_text, ''), COALESCE(last_corrected_text, ''), updated_at
		FROM mistake_memory`
}

func memoryScan(memory *learning.MistakeMemory) []any {
	return []any{
		&memory.ID, &memory.UserID, &memory.PatternKey, &memory.Type, &memory.Title,
		&memory.Description, &memory.TotalCount, &memory.RecentCount, &memory.FirstSeenAt,
		&memory.LastSeenAt, &memory.Status, &memory.LastOriginalText,
		&memory.LastCorrectedText, &memory.UpdatedAt,
	}
}

func sessionSelect() string {
	return `SELECT id, user_id, date, started_at, ended_at, duration_seconds, total_results,
		total_words, unique_words, new_words_count, mistakes_count, grammar_errors,
		vocabulary_errors, pronunciation_errors, avg_score, COALESCE(cefr_level, ''),
		COALESCE(main_weak_point, ''), COALESCE(summary, ''), COALESCE(next_step, '')
		FROM daily_sessions`
}

func sessionScan(session *learning.DailySession) []any {
	return []any{
		&session.ID, &session.UserID, &session.Date, &session.StartedAt, &session.EndedAt,
		&session.DurationSeconds, &session.TotalResults, &session.TotalWords,
		&session.UniqueWords, &session.NewWordsCount, &session.MistakesCount,
		&session.GrammarErrors, &session.VocabularyErrors, &session.PronunciationErrors,
		&session.AvgScore, &session.CEFRLevel, &session.MainWeakPoint, &session.Summary,
		&session.NextStep,
	}
}

func dailySummary(metrics daily.ResultMetrics) string {
	if metrics.MainWeakPoint != "" {
		return fmt.Sprintf("You practiced an answer. %s is the main weak point today.", metrics.MainWeakPoint)
	}
	return "You practiced an answer and added to today's learning progress."
}

func overused(counts map[string]int) []learning.WordSuggestion {
	alts := map[string][]string{
		"good": []string{"useful", "strong", "excellent"},
		"very": []string{"really", "extremely", "especially"},
		"nice": []string{"pleasant", "kind", "enjoyable"},
	}
	items := make([]learning.WordSuggestion, 0)
	for word, suggestions := range alts {
		if counts[word] >= 2 {
			items = append(items, learning.WordSuggestion{Word: word, Alternatives: suggestions})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Word < items[j].Word })
	return items
}

func nullString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
