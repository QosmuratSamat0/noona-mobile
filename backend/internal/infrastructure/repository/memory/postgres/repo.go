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

func (r *Repo) GetByPattern(ctx context.Context, userID, patternKey string) (*learning.MistakeMemory, error) {
	memory := &learning.MistakeMemory{}
	err := r.db.QueryRow(ctx, memorySelect()+` WHERE user_id = $1 AND pattern_key = $2`, userID, patternKey).Scan(memoryScan(memory)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return memory, err
}

func (r *Repo) Create(ctx context.Context, memory *learning.MistakeMemory) error {
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

func (r *Repo) Update(ctx context.Context, memory *learning.MistakeMemory) error {
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

func (r *Repo) ListByUser(ctx context.Context, userID string) ([]learning.MistakeMemory, error) {
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

func nullString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
