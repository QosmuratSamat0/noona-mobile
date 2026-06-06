package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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

func (r *Repo) StartSession(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
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

func (r *Repo) FinishSession(ctx context.Context, userID, sessionID string, endedAt time.Time) (*learning.DailySession, error) {
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

func (r *Repo) GetSession(ctx context.Context, userID, sessionID string) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, sessionSelect()+` WHERE user_id = $1 AND id = $2`, userID, sessionID).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *Repo) GetByDate(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, sessionSelect()+` WHERE user_id = $1 AND date = $2 ORDER BY started_at DESC LIMIT 1`, userID, date.Format("2006-01-02")).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *Repo) GetTodayOpenSession(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
	session := &learning.DailySession{}
	err := r.db.QueryRow(ctx, sessionSelect()+` WHERE user_id = $1 AND date = $2 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`, userID, date.Format("2006-01-02")).Scan(sessionScan(session)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return session, err
}

func (r *Repo) UpdateAfterResult(ctx context.Context, sessionID string, metrics learning.ResultMetrics) error {
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

func dailySummary(metrics learning.ResultMetrics) string {
	if metrics.MainWeakPoint != "" {
		return fmt.Sprintf("You practiced an answer. %s is the main weak point today.", metrics.MainWeakPoint)
	}
	return "You practiced an answer and added to today's learning progress."
}

func nullString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
