package postgres

import (
	"context"
	"errors"
	"fmt"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PostgresRepo {
	return &PostgresRepo{db: db}
}

func (r *PostgresRepo) RecordActivity(ctx context.Context, userID string) error {
	query := `
		WITH update_stats AS (
			INSERT INTO daily_stats (user_id, date, session_count)
			VALUES ($1, CURRENT_DATE, 1)
			ON CONFLICT (user_id, date)
			DO UPDATE SET session_count = daily_stats.session_count + 1
		)
		INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date)
		VALUES ($1, 1, 1, CURRENT_DATE)
		ON CONFLICT (user_id) DO UPDATE SET
			current_streak = CASE
				WHEN streaks.last_activity_date = CURRENT_DATE THEN streaks.current_streak
				WHEN streaks.last_activity_date = CURRENT_DATE - 1 THEN streaks.current_streak + 1
				ELSE 1
			END,
			longest_streak = CASE
				WHEN streaks.last_activity_date = CURRENT_DATE THEN streaks.longest_streak
				WHEN streaks.last_activity_date = CURRENT_DATE - 1 AND streaks.current_streak + 1 > streaks.longest_streak THEN streaks.current_streak + 1
				ELSE streaks.longest_streak
			END,
			last_activity_date = CURRENT_DATE
	`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("record activity: %w", err)
	}
	return nil
}

func (r *PostgresRepo) GetDailyStats(ctx context.Context, userID string) ([]*domain.DailyStat, error) {
	query := `SELECT id, user_id, date, session_count FROM daily_stats WHERE user_id = $1 ORDER BY date DESC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*domain.DailyStat
	for rows.Next() {
		s := &domain.DailyStat{}
		if err := rows.Scan(&s.ID, &s.UserID, &s.Date, &s.SessionCount); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *PostgresRepo) GetStreak(ctx context.Context, userID string) (*domain.Streak, error) {
	query := `SELECT id, user_id, current_streak, longest_streak, last_activity_date FROM streaks WHERE user_id = $1`

	s := &domain.Streak{}
	err := r.db.QueryRow(ctx, query, userID).Scan(&s.ID, &s.UserID, &s.CurrentStreak, &s.LongestStreak, &s.LastActivityDate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// If no streak record, return a default empty one instead of error
			return &domain.Streak{UserID: userID}, nil
		}
		return nil, fmt.Errorf("get streak: %w", err)
	}
	return s, nil
}
