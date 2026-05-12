package middleware

import (
	"net/http"
	"sync"
	"time"

	resp "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/api/response"
	"github.com/go-chi/render"
	"golang.org/x/time/rate"
)

type userLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	limiters = make(map[string]*userLimiter)
	mu       sync.Mutex
)

func init() {
	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			for userID, limiter := range limiters {
				if time.Since(limiter.lastSeen) > 3*time.Minute {
					delete(limiters, userID)
				}
			}
			mu.Unlock()
		}
	}()
}

func getUserLimiter(userID string) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()

	limiter, exists := limiters[userID]
	if !exists {
		limiter = &userLimiter{
			limiter:  rate.NewLimiter(rate.Limit(10.0/60.0), 10),
			lastSeen: time.Now(),
		}
		limiters[userID] = limiter
	}
	limiter.lastSeen = time.Now()
	return limiter.limiter
}

func RateLimitMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := GetUserFromContext(r.Context())
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			limiter := getUserLimiter(user.ID)
			if !limiter.Allow() {
				render.Status(r, http.StatusTooManyRequests)
				render.JSON(w, r, resp.Error("rate limit exceeded"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
