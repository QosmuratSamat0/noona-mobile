package daily

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Start(ctx context.Context, userID string) (*learning.DailySession, error) {
	return s.repo.StartSession(ctx, userID, time.Now())
}

func (s *Service) Finish(ctx context.Context, userID, sessionID string) (*learning.DailySession, error) {
	return s.repo.FinishSession(ctx, userID, sessionID, time.Now())
}

func (s *Service) Today(ctx context.Context, userID string) (*learning.DailySession, error) {
	return s.repo.GetByDate(ctx, userID, time.Now())
}

func (s *Service) ByDate(ctx context.Context, userID string, date time.Time) (*learning.DailySession, error) {
	return s.repo.GetByDate(ctx, userID, date)
}

func (s *Service) EnsureSession(ctx context.Context, userID, sessionID string) (*learning.DailySession, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID != "" {
		return s.repo.GetSession(ctx, userID, sessionID)
	}
	today := time.Now()
	session, err := s.repo.GetTodayOpenSession(ctx, userID, today)
	if err == nil && session != nil {
		return session, nil
	}
	return s.repo.StartSession(ctx, userID, today)
}

func (s *Service) ApplyResult(ctx context.Context, sessionID string, metrics ResultMetrics) error {
	if strings.TrimSpace(sessionID) == "" {
		return fmt.Errorf("daily session id is required")
	}
	return s.repo.UpdateAfterResult(ctx, sessionID, metrics)
}
