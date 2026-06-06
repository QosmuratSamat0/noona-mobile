package postgres

import (
	"context"
	"database/sql"
	"strings"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

func (r *Repo) HasPendingForPattern(ctx context.Context, userID, patternKey string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM practice_drills
			WHERE user_id = $1 AND pattern_key = $2 AND status = 'pending'
		)
	`, userID, patternKey).Scan(&exists)
	return exists, err
}

func (r *Repo) CreateDrill(ctx context.Context, drill *learning.Drill) error {
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

func (r *Repo) ListDrillsByUser(ctx context.Context, userID string) ([]learning.Drill, error) {
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
