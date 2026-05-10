package middleware

import (
	"context"

	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
)

type contextKey string

const userContextKey contextKey = "user"

func GetUserFromContext(ctx context.Context) (*userDomain.User, bool) {
	user, ok := ctx.Value(userContextKey).(*userDomain.User)
	return user, ok
}
