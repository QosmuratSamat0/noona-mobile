package postgres

import (
	"context"
	"errors"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/jackc/pgx/v5"
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

func (r *PostgresRepo) GetTranscriptByMessageID(ctx context.Context, messageID string, userID string) (*domain.Transcript, error) {
	query := `
		SELECT t.id, t.message_id, t.raw_text 
		FROM transcripts t
		JOIN messages m ON t.message_id = m.id
		JOIN sessions s ON m.session_id = s.id
		WHERE t.message_id = $1 AND s.user_id = $2
	`
	t := &domain.Transcript{}
	err := r.db.QueryRow(ctx, query, messageID, userID).Scan(&t.ID, &t.MessageID, &t.RawText)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errs.ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *PostgresRepo) SaveCorrection(ctx context.Context, c *domain.Correction) error {
	query := `INSERT INTO corrections (transcript_id, corrected_text, explanation, cefr_level) VALUES ($1, $2, $3, $4) RETURNING id`
	return r.db.QueryRow(ctx, query, c.TranscriptID, c.CorrectedText, c.Explanation, c.CEFRLevel).Scan(&c.ID)
}

func (r *PostgresRepo) GetCorrectionsByTranscriptID(ctx context.Context, transcriptID string) ([]*domain.Correction, error) {
	query := `SELECT id, transcript_id, corrected_text, explanation, cefr_level FROM corrections WHERE transcript_id = $1`
	rows, err := r.db.Query(ctx, query, transcriptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var corrections []*domain.Correction
	for rows.Next() {
		c := &domain.Correction{}
		if err := rows.Scan(&c.ID, &c.TranscriptID, &c.CorrectedText, &c.Explanation, &c.CEFRLevel); err != nil {
			return nil, err
		}
		corrections = append(corrections, c)
	}
	return corrections, nil
}

func (r *PostgresRepo) CreateMistake(ctx context.Context, m domain.MistakeModel) error {
	query := `INSERT INTO mistakes (user_id, type, original, corrected, offset_pos) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(ctx, query, m.UserID, m.Type, m.Original, m.Corrected, m.OffsetPos)
	return err
}

func (r *PostgresRepo) GetMistakesByUserID(ctx context.Context, userID string) ([]*domain.MistakeModel, error) {
	query := `SELECT id, user_id, type, original, corrected, offset_pos, created_at FROM mistakes WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mistakes []*domain.MistakeModel
	for rows.Next() {
		m := &domain.MistakeModel{}
		if err := rows.Scan(&m.ID, &m.UserID, &m.Type, &m.Original, &m.Corrected, &m.OffsetPos, &m.CreatedAt); err != nil {
			return nil, err
		}
		mistakes = append(mistakes, m)
	}
	return mistakes, nil
}
