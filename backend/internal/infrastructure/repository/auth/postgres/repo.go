package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/auth"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
)

type PostgresRepo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PostgresRepo {
	return &PostgresRepo{db: db}
}

func (repo *PostgresRepo) GetRefreshToken(ctx context.Context, token string) (*domain.RefreshToken, error) {
	query := `SELECT token, user_id, expires_at FROM refresh_tokens WHERE token = $1`
	row := repo.db.QueryRow(ctx, query, token)

	var rt domain.RefreshToken
	err := row.Scan(&rt.Token, &rt.UserID, &rt.ExpiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errs.ErrNotFound
		}
		return nil, err
	}

	return &rt, nil
}

func (repo *PostgresRepo) SaveRefreshToken(ctx context.Context, token string, userID string, expiresAt time.Time) error {
	query := `INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)`
	_, err := repo.db.Exec(ctx, query, token, userID, expiresAt)
	if err != nil {
		return err
	}
	return nil
}

func (repo *PostgresRepo) ValidateRefreshToken(ctx context.Context, token string) (string, error) {
	query := `SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`
	row := repo.db.QueryRow(ctx, query, token)

	var userID string
	err := row.Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errs.ErrNotFound
		}
		return "", err
	}

	return userID, nil
}

func (repo *PostgresRepo) DeleteRefreshToken(ctx context.Context, token string) (string, error) {
	query := `DELETE FROM refresh_tokens WHERE token = $1 AND expires_at > NOW() RETURNING user_id`
	var userID string
	err := repo.db.QueryRow(ctx, query, token).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errs.ErrNotFound
		}
		return "", err
	}
	return userID, nil
}
