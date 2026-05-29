package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/cache/jsoncache"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
	repo.invalidateUserCache(ctx, user)
	return nil
}

func (r *PostgresRepo) GetAllUsers(ctx context.Context) ([]*domain.User, error) {
	const key = "users:all"
	if cached, ok := jsoncache.Get[[]*domain.User](ctx, r.cache, key); ok {
		return cached, nil
	}

	const query = `
		SELECT u.id, u.name, u.email, u.role, COALESCE(p.cefr_level, 'A1'), u.created_at, u.updated_at
		FROM users u
		LEFT JOIN profiles p ON p.user_id = u.id
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
			&u.CEFRLevel,
			&u.CreatedAt,
			&u.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		users = append(users, &u)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	jsoncache.Set(ctx, r.cache, key, users, r.cacheTTL)
	return users, nil
}

func (repo *PostgresRepo) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	key := userByIDCacheKey(id)
	if cached, ok := jsoncache.Get[*domain.User](ctx, repo.cache, key); ok {
		return cached, nil
	}

	query := `
		SELECT u.id, u.name, u.email, u.password_hash, u.role, COALESCE(p.cefr_level, 'A1'), u.created_at, u.updated_at
		FROM users u
		LEFT JOIN profiles p ON p.user_id = u.id
		WHERE u.id = $1
	`
	u := &domain.User{}

	err := repo.db.QueryRow(ctx, query, id).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CEFRLevel, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	jsoncache.Set(ctx, repo.cache, key, u, repo.cacheTTL)
	jsoncache.Set(ctx, repo.cache, userByEmailCacheKey(u.Email), u, repo.cacheTTL)
	return u, nil
}

func (repo *PostgresRepo) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	key := userByEmailCacheKey(email)
	if cached, ok := jsoncache.Get[*domain.User](ctx, repo.cache, key); ok {
		return cached, nil
	}

	query := `
		SELECT u.id, u.name, u.email, u.password_hash, u.role, COALESCE(p.cefr_level, 'A1'), u.created_at, u.updated_at
		FROM users u
		LEFT JOIN profiles p ON p.user_id = u.id
		WHERE u.email = $1
	`

	u := &domain.User{}
	err := repo.db.QueryRow(ctx, query, email).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CEFRLevel, &u.CreatedAt, &u.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	jsoncache.Set(ctx, repo.cache, key, u, repo.cacheTTL)
	jsoncache.Set(ctx, repo.cache, userByIDCacheKey(u.ID), u, repo.cacheTTL)
	return u, nil
}

func (repo *PostgresRepo) UpdateUser(ctx context.Context, user *domain.User) error {
	previous, _ := repo.GetUserByID(ctx, user.ID)

	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin update user: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4`

	_, err = tx.Exec(ctx, query, user.Username, user.Email, user.Role, user.ID)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}

	if user.CEFRLevel != "" {
		_, err = tx.Exec(
			ctx,
			`INSERT INTO profiles (user_id, cefr_level) VALUES ($1, $2)
			 ON CONFLICT (user_id) DO UPDATE SET cefr_level = EXCLUDED.cefr_level`,
			user.ID,
			user.CEFRLevel,
		)
		if err != nil {
			return fmt.Errorf("update user profile: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	repo.invalidateUserCache(ctx, previous)
	repo.invalidateUserCache(ctx, user)
	return nil
}

func (repo *PostgresRepo) DeleteUser(ctx context.Context, id string) error {
	previous, _ := repo.GetUserByID(ctx, id)
	query := `DELETE FROM users WHERE id = $1`

	_, err := repo.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	repo.invalidateUserCache(ctx, previous)
	jsoncache.Delete(ctx, repo.cache, userByIDCacheKey(id), "users:all", adminCountCacheKey())
	return nil
}

func (r *PostgresRepo) CountAdmins(ctx context.Context) (int, error) {
	key := adminCountCacheKey()
	if cached, ok := jsoncache.Get[int](ctx, r.cache, key); ok {
		return cached, nil
	}

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

	jsoncache.Set(ctx, r.cache, key, count, r.cacheTTL)
	return count, nil
}

func (repo *PostgresRepo) invalidateUserCache(ctx context.Context, user *domain.User) {
	if user == nil {
		return
	}
	keys := []string{userByIDCacheKey(user.ID), "users:all", adminCountCacheKey()}
	if strings.TrimSpace(user.Email) != "" {
		keys = append(keys, userByEmailCacheKey(user.Email))
	}
	jsoncache.Delete(ctx, repo.cache, keys...)
}

func userByIDCacheKey(id string) string {
	return "user:id:" + id
}

func userByEmailCacheKey(email string) string {
	return "user:email:" + strings.ToLower(strings.TrimSpace(email))
}

func adminCountCacheKey() string {
	return "users:admin_count"
}
