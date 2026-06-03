package postgres

import (
	"context"
	"fmt"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/cache/jsoncache"
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

func (r *PostgresRepo) CreateSession(ctx context.Context, userID string) (*domain.Session, error) {
	session, _, err := r.GetOrCreateDailySession(ctx, userID)
	return session, err
}

func (r *PostgresRepo) GetOrCreateDailySession(ctx context.Context, userID string) (*domain.Session, bool, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, false, fmt.Errorf("begin daily session tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, "daily_session:"+userID); err != nil {
		return nil, false, fmt.Errorf("lock daily session: %w", err)
	}

	s := &domain.Session{}
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, created_at
		FROM sessions
		WHERE user_id = $1
		  AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
		  AND created_at < ((date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC')
		ORDER BY created_at DESC
		LIMIT 1`, userID).Scan(&s.ID, &s.UserID, &s.CreatedAt)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, false, fmt.Errorf("commit daily session tx: %w", err)
		}
		r.setCache(ctx, sessionCacheKey(s.ID), s)
		return s, false, nil
	}
	if err != pgx.ErrNoRows {
		return nil, false, fmt.Errorf("get daily session: %w", err)
	}

	err = tx.QueryRow(ctx, `INSERT INTO sessions (user_id) VALUES ($1) RETURNING id, user_id, created_at`, userID).
		Scan(&s.ID, &s.UserID, &s.CreatedAt)
	if err != nil {
		return nil, false, fmt.Errorf("create daily session: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, false, fmt.Errorf("commit daily session tx: %w", err)
	}

	r.setCache(ctx, sessionCacheKey(s.ID), s)
	r.deleteCache(ctx, userSessionsCacheKey(userID))
	return s, true, nil
}

func (r *PostgresRepo) GetSession(ctx context.Context, sessionID string) (*domain.Session, error) {
	key := sessionCacheKey(sessionID)
	if cached, ok := jsoncache.Get[*domain.Session](ctx, r.cache, key); ok && cached != nil {
		return cached, nil
	}

	query := `SELECT id, user_id, created_at FROM sessions WHERE id = $1`

	s := &domain.Session{}
	err := r.db.QueryRow(ctx, query, sessionID).Scan(&s.ID, &s.UserID, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	r.setCache(ctx, key, s)
	return s, nil
}

func (r *PostgresRepo) GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error) {
	key := userSessionsCacheKey(userID)
	if cached, ok := jsoncache.Get[[]*domain.Session](ctx, r.cache, key); ok {
		return cached, nil
	}

	query := `SELECT id, user_id, created_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("get user sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*domain.Session
	for rows.Next() {
		s := &domain.Session{}
		if err := rows.Scan(&s.ID, &s.UserID, &s.CreatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	r.setCache(ctx, key, sessions)
	return sessions, nil
}

func (r *PostgresRepo) SaveMessage(ctx context.Context, msg *domain.Message) error {
	query := `INSERT INTO messages (session_id, role, content, audio_url) VALUES ($1, $2, $3, NULLIF($4, '')) RETURNING id, created_at`

	err := r.db.QueryRow(ctx, query, msg.SessionID, msg.Role, msg.Content, msg.AudioURL).Scan(&msg.ID, &msg.CreatedAt)
	if err != nil {
		return fmt.Errorf("save message: %w", err)
	}

	r.deleteCache(ctx, sessionMessagesCacheKey(msg.SessionID))
	return nil
}

func (r *PostgresRepo) UpdateMessageAudioURL(ctx context.Context, messageID, audioURL string) error {
	query := `UPDATE messages SET audio_url = NULLIF($2, '') WHERE id = $1 RETURNING session_id`
	var sessionID string
	err := r.db.QueryRow(ctx, query, messageID, audioURL).Scan(&sessionID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("update message audio url: message not found")
		}
		return fmt.Errorf("update message audio url: %w", err)
	}
	r.deleteCache(ctx, sessionMessagesCacheKey(sessionID))
	return nil
}

func (r *PostgresRepo) GetSessionMessages(ctx context.Context, sessionID string) ([]*domain.Message, error) {
	key := sessionMessagesCacheKey(sessionID)
	if cached, ok := jsoncache.Get[[]*domain.Message](ctx, r.cache, key); ok {
		return cached, nil
	}

	query := `
		SELECT
			m.id,
			m.session_id,
			m.role,
			m.content,
			COALESCE(m.audio_url, ''),
			m.created_at
		FROM messages m
		WHERE m.session_id = $1
		ORDER BY m.created_at ASC`

	rows, err := r.db.Query(ctx, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("get session messages: %w", err)
	}
	defer rows.Close()

	var messages []*domain.Message
	for rows.Next() {
		m := &domain.Message{}
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.AudioURL, &m.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	r.setCache(ctx, key, messages)
	return messages, nil
}

func userSessionsCacheKey(userID string) string {
	return "chat:sessions:user:" + userID
}

func sessionCacheKey(sessionID string) string {
	return "chat:session:" + sessionID
}

func sessionMessagesCacheKey(sessionID string) string {
	return "chat:messages:session:" + sessionID
}

func (r *PostgresRepo) setCache(ctx context.Context, key string, value any) {
	jsoncache.Set(ctx, r.cache, key, value, r.cacheTTL)
}

func (r *PostgresRepo) deleteCache(ctx context.Context, keys ...string) {
	jsoncache.Delete(ctx, r.cache, keys...)
}
