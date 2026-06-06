package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

func (r *Repo) CreateBundle(ctx context.Context, input learning.ResultBundleInput) (*learning.ResultBundle, error) {
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

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &bundle, nil
}

func (r *Repo) GetResult(ctx context.Context, userID, resultID string) (*learning.Result, error) {
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

func (r *Repo) ListResults(ctx context.Context, userID, sessionID string) ([]learning.Result, error) {
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

func (r *Repo) ListRecentResults(ctx context.Context, userID string, limit int) ([]learning.Result, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, transcript_id, COALESCE(daily_session_id::text, ''),
			original_text, corrected_text, score, COALESCE(cefr_level, ''),
			fluency_score, grammar_score, vocabulary_score, pronunciation_score,
			COALESCE(summary, ''), COALESCE(next_step, ''), created_at
		FROM results
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
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

func nullString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
