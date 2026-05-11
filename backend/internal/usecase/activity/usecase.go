package activity

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
)

type UseCase struct {
	repo ActivityRepo
}

func NewUseCase(repo ActivityRepo) *UseCase {
	return &UseCase{repo: repo}
}

func (uc *UseCase) RecordActivity(ctx context.Context, userID string) error {
	if err := uc.repo.IncrementDailySession(ctx, userID); err != nil {
		return err
	}
	return uc.repo.UpdateStreak(ctx, userID)
}

func (uc *UseCase) GetActivity(ctx context.Context, userID string) (*domain.Streak, []*domain.DailyStat, error) {
	streak, err := uc.repo.GetStreak(ctx, userID)
	if err != nil {
		return nil, nil, err
	}

	stats, err := uc.repo.GetDailyStats(ctx, userID)
	if err != nil {
		return nil, nil, err
	}

	return streak, stats, nil
}
