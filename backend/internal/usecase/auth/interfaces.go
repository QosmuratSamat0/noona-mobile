package auth

import (
	"context"
	"time"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/auth"
	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
)

type TokenRepo interface {
	GetRefreshToken(ctx context.Context, token string) (*domain.RefreshToken, error)
	SaveRefreshToken(ctx context.Context, token string, userID string, expiresAt time.Time) error
	DeleteRefreshToken(ctx context.Context, token string) (string, error)
}

type UserRepo interface {
	GetUserByEmail(ctx context.Context, email string) (*userDomain.User, error)
	CreateUser(ctx context.Context, user *userDomain.User) error
}
