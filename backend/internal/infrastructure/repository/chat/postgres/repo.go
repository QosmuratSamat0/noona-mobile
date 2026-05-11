package postgres

import (
	"context"
	"fmt"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PostgresRepo {
	return &PostgresRepo{db: db}
}

func (r *PostgresRepo) CreateSession(ctx context.Context, userID string) (*domain.Session, error) {
	query := `INSERT INTO sessions (user_id) VALUES ($1) RETURNING id, user_id, created_at`

	s := &domain.Session{}
	err := r.db.QueryRow(ctx, query, userID).Scan(&s.ID, &s.UserID, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	return s, nil
}

func (r *PostgresRepo) GetSession(ctx context.Context, sessionID string) (*domain.Session, error) {
	query := `SELECT id, user_id, created_at FROM sessions WHERE id = $1`

	s := &domain.Session{}
	err := r.db.QueryRow(ctx, query, sessionID).Scan(&s.ID, &s.UserID, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	return s, nil
}

func (r *PostgresRepo) GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error) {
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

	return sessions, nil
}

func (r *PostgresRepo) SaveMessage(ctx context.Context, msg *domain.Message) error {
	query := `INSERT INTO messages (session_id, role, content) VALUES ($1, $2, $3) RETURNING id, created_at`

	err := r.db.QueryRow(ctx, query, msg.SessionID, msg.Role, msg.Content).Scan(&msg.ID, &msg.CreatedAt)
	if err != nil {
		return fmt.Errorf("save message: %w", err)
	}

	return nil
}

func (r *PostgresRepo) GetSessionMessages(ctx context.Context, sessionID string) ([]*domain.Message, error) {
	query := `SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC`

	rows, err := r.db.Query(ctx, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("get session messages: %w", err)
	}
	defer rows.Close()

	var messages []*domain.Message
	for rows.Next() {
		m := &domain.Message{}
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}

	return messages, nil
}
