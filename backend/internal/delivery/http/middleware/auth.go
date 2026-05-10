package middleware

import (
	"context"
	"net/http"
	"strings"

	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	token "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/tokens"
)

func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "missing authorization header", http.StatusUnauthorized)
				return
			}

			var tokenStr string

			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			} else {
				tokenStr = authHeader
			}

			tokenStr = strings.TrimSpace(tokenStr)

			claims, err := token.ParseJWT(tokenStr, secret)
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			user := &userDomain.User{
				ID:   claims.UserID,
				Role: userDomain.Role(claims.Role),
			}

			ctx := context.WithValue(r.Context(), userContextKey, user)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
