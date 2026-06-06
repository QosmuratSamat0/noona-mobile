package postgres

import (
	"context"
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

func (r *Repo) CreateForResult(ctx context.Context, userID, resultID, transcriptID string, mistakes []learning.Mistake) ([]learning.Mistake, error) {
	if len(mistakes) == 0 {
		return []learning.Mistake{}, nil
	}

	created := make([]learning.Mistake, 0, len(mistakes))
	for _, mistake := range mistakes {
		mistake.UserID = userID
		mistake.ResultID = resultID
		mistake.TranscriptID = transcriptID
		if err := r.db.QueryRow(ctx, `
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
		created = append(created, mistake)
	}
	return created, nil
}

func (r *Repo) GetByResult(ctx context.Context, userID, resultID string) ([]learning.Mistake, error) {
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

func nullString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
