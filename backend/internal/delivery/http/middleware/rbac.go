package middleware

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/render"
	authDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/auth"
	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
)

func RequirePermission(p authDomain.Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log := slog.With("permission", p)

			user, ok := GetUserFromContext(r.Context())
			if !ok {
				log.Info("unauthorized: no user in context")
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, resp.Error("unauthorized"))
				return
			}

			if !authDomain.HasPermission(userDomain.Role(user.Role), p) {
				log.Info("forbidden", slog.String("user_id", user.ID))
				render.Status(r, http.StatusForbidden)
				render.JSON(w, r, resp.Error("forbidden"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
