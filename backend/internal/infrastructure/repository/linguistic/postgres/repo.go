package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/cache/jsoncache"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type PostgresRepo struct {
	db       *pgxpool.Pool
	cache    *redis.Client
	cacheTTL time.Duration
}

func New(db *pgxpool.Pool, cache ...*redis.Client) *PostgresRepo {
	repo := &PostgresRepo{
		db:       db,
		cacheTTL: 5 * time.Minute,
	}
	if len(cache) > 0 {
		repo.cache = cache[0]
	}
	return repo
}

func (r *PostgresRepo) SaveTranscript(ctx context.Context, t *domain.Transcript) error {
	query := `INSERT INTO transcripts (message_id, raw_text) VALUES ($1, $2) RETURNING id`
	var messageID any
	if t.MessageID != "" {
		messageID = t.MessageID
	}
	if err := r.db.QueryRow(ctx, query, messageID, t.RawText).Scan(&t.ID); err != nil {
		return err
	}
	return nil
}

func (r *PostgresRepo) GetTranscriptByMessageID(ctx context.Context, messageID string, userID string) (*domain.Transcript, error) {
	key := transcriptByMessageCacheKey(userID, messageID)
	if cached, ok := jsoncache.Get[*domain.Transcript](ctx, r.cache, key); ok && cached != nil {
		return cached, nil
	}

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
	jsoncache.Set(ctx, r.cache, key, t, r.cacheTTL)
	return t, nil
}

func (r *PostgresRepo) SaveCorrection(ctx context.Context, c *domain.Correction) error {
	query := `INSERT INTO corrections (transcript_id, corrected_text, explanation, cefr_level) VALUES ($1, $2, $3, $4) RETURNING id`
	if err := r.db.QueryRow(ctx, query, c.TranscriptID, c.CorrectedText, c.Explanation, c.CEFRLevel).Scan(&c.ID); err != nil {
		return err
	}
	jsoncache.Delete(ctx, r.cache, correctionsByTranscriptCacheKey(c.TranscriptID))
	r.invalidateChatMessagesByTranscript(ctx, c.TranscriptID)
	return nil
}

func (r *PostgresRepo) GetCorrectionsByTranscriptID(ctx context.Context, transcriptID string) ([]*domain.Correction, error) {
	key := correctionsByTranscriptCacheKey(transcriptID)
	if cached, ok := jsoncache.Get[[]*domain.Correction](ctx, r.cache, key); ok {
		return cached, nil
	}

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	jsoncache.Set(ctx, r.cache, key, corrections, r.cacheTTL)
	return corrections, nil
}

func (r *PostgresRepo) CreateMistake(ctx context.Context, m domain.MistakeModel) error {
	query := `INSERT INTO mistakes (user_id, type, original, corrected, offset_pos) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(ctx, query, m.UserID, m.Type, m.Original, m.Corrected, m.OffsetPos)
	if err == nil {
		jsoncache.Delete(ctx, r.cache, mistakesByUserCacheKey(m.UserID))
	}
	return err
}

func (r *PostgresRepo) GetMistakesByUserID(ctx context.Context, userID string) ([]*domain.MistakeModel, error) {
	key := mistakesByUserCacheKey(userID)
	if cached, ok := jsoncache.Get[[]*domain.MistakeModel](ctx, r.cache, key); ok {
		return cached, nil
	}

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	jsoncache.Set(ctx, r.cache, key, mistakes, r.cacheTTL)
	return mistakes, nil
}

func (r *PostgresRepo) UpdateCEFRLevel(ctx context.Context, userID string, level string) error {
	var email string
	_ = r.db.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, userID).Scan(&email)

	query := `INSERT INTO profiles (user_id, cefr_level) VALUES ($1, $2)
              ON CONFLICT (user_id) DO UPDATE SET cefr_level = EXCLUDED.cefr_level`
	_, err := r.db.Exec(ctx, query, userID, level)
	if err == nil {
		keys := []string{"user:id:" + userID, "users:all"}
		if strings.TrimSpace(email) != "" {
			keys = append(keys, "user:email:"+strings.ToLower(strings.TrimSpace(email)))
		}
		jsoncache.Delete(ctx, r.cache, keys...)
	}
	return err
}

func transcriptByMessageCacheKey(userID, messageID string) string {
	return "linguistic:transcript:user:" + userID + ":message:" + messageID
}

func correctionsByTranscriptCacheKey(transcriptID string) string {
	return "linguistic:corrections:transcript:" + transcriptID
}

func mistakesByUserCacheKey(userID string) string {
	return "linguistic:mistakes:user:" + userID
}

func (r *PostgresRepo) invalidateChatMessagesByTranscript(ctx context.Context, transcriptID string) {
	var sessionID string
	err := r.db.QueryRow(ctx, `
		SELECT m.session_id
		FROM transcripts t
		JOIN messages m ON m.id = t.message_id
		WHERE t.id = $1
	`, transcriptID).Scan(&sessionID)
	if err != nil || sessionID == "" {
		return
	}
	jsoncache.Delete(ctx, r.cache, "chat:messages:session:"+sessionID)
}
