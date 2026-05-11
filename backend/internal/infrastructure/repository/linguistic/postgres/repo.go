package postgres

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PostgresRepo {
	return &PostgresRepo{db: db}
}

func (r *PostgresRepo) SaveTranscript(ctx context.Context, t *domain.Transcript) error {
	query := `INSERT INTO transcripts (message_id, raw_text) VALUES ($1, $2) RETURNING id`
	return r.db.QueryRow(ctx, query, t.MessageID, t.RawText).Scan(&t.ID)
}

func (r *PostgresRepo) GetTranscriptByMessageID(ctx context.Context, messageID string) (*domain.Transcript, error) {
	query := `SELECT id, message_id, raw_text FROM transcripts WHERE message_id = $1`
	t := &domain.Transcript{}
	err := r.db.QueryRow(ctx, query, messageID).Scan(&t.ID, &t.MessageID, &t.RawText)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *PostgresRepo) SaveCorrection(ctx context.Context, c *domain.Correction) error {
	query := `INSERT INTO corrections (transcript_id, corrected_text, explanation) VALUES ($1, $2, $3) RETURNING id`
	return r.db.QueryRow(ctx, query, c.TranscriptID, c.CorrectedText, c.Explanation).Scan(&c.ID)
}

func (r *PostgresRepo) GetCorrectionsByTranscriptID(ctx context.Context, transcriptID string) ([]*domain.Correction, error) {
	query := `SELECT id, transcript_id, corrected_text, explanation FROM corrections WHERE transcript_id = $1`
	rows, err := r.db.Query(ctx, query, transcriptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var corrections []*domain.Correction
	for rows.Next() {
		c := &domain.Correction{}
		if err := rows.Scan(&c.ID, &c.TranscriptID, &c.CorrectedText, &c.Explanation); err != nil {
			return nil, err
		}
		corrections = append(corrections, c)
	}
	return corrections, nil
}

func (r *PostgresRepo) SaveMistake(ctx context.Context, m *domain.Mistake) error {
	query := `INSERT INTO mistakes (user_id, type, original, fixed) VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	return r.db.QueryRow(ctx, query, m.UserID, m.Type, m.Original, m.Fixed).Scan(&m.ID, &m.CreatedAt)
}

func (r *PostgresRepo) GetUserMistakes(ctx context.Context, userID string) ([]*domain.Mistake, error) {
	query := `SELECT id, user_id, type, original, fixed, created_at FROM mistakes WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mistakes []*domain.Mistake
	for rows.Next() {
		m := &domain.Mistake{}
		if err := rows.Scan(&m.ID, &m.UserID, &m.Type, &m.Original, &m.Fixed, &m.CreatedAt); err != nil {
			return nil, err
		}
		mistakes = append(mistakes, m)
	}
	return mistakes, nil
}
