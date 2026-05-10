package postgres

import (
	"context"
	"errors"
	"fmt"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PostgresRepo {
	return &PostgresRepo{db: db}
}

func (repo *PostgresRepo) CreateUser(ctx context.Context, user *domain.User) error {
	query := `INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`
	err := repo.db.QueryRow(ctx, query, user.Username, user.Email, user.Role, user.PasswordHash).Scan(&user.ID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if pgErr.ConstraintName == "users_email_key" {
				return errs.ErrAlreadyExists
			}
		}
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *PostgresRepo) GetAllUsers(ctx context.Context) ([]*domain.User, error) {
	const query = `
		SELECT id, name, email, role, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User

	for rows.Next() {
		var u domain.User
		err := rows.Scan(
			&u.ID,
			&u.Username,
			&u.Email,
			&u.Role,
			&u.CreatedAt,
			&u.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		users = append(users, &u)
	}

	return users, nil
}

func (repo *PostgresRepo) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := `SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1`
	u := &domain.User{}

	err := repo.db.QueryRow(ctx, query, id).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return u, nil
}

func (repo *PostgresRepo) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1`

	u := &domain.User{}
	err := repo.db.QueryRow(ctx, query, email).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return u, nil
}

func (repo *PostgresRepo) UpdateUser(ctx context.Context, user *domain.User) error {
	query := `UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4`

	_, err := repo.db.Exec(ctx, query, user.Username, user.Email, user.Role, user.ID)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}

	return nil
}

func (repo *PostgresRepo) DeleteUser(ctx context.Context, id string) error {
	query := `DELETE FROM users WHERE id = $1`

	_, err := repo.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	return nil
}

func (r *PostgresRepo) CountAdmins(ctx context.Context) (int, error) {
	const query = `
		SELECT COUNT(*)
		FROM users
		WHERE role = $1
	`

	var count int

	err := r.db.QueryRow(ctx, query, string(domain.RoleAdmin)).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}
