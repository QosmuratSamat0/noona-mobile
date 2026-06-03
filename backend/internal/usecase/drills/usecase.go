package drills

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

type Repository interface {
	HasPendingForPattern(ctx context.Context, userID, patternKey string) (bool, error)
	CreateDrill(ctx context.Context, drill *learning.Drill) error
	ListDrillsByUser(ctx context.Context, userID string) ([]learning.Drill, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GenerateForMemories(ctx context.Context, userID string, memories []learning.MistakeMemory) ([]learning.Drill, error) {
	drills := make([]learning.Drill, 0)
	for _, memory := range memories {
		if memory.TotalCount < 2 || memory.Status == "fixed" {
			continue
		}
		exists, err := s.repo.HasPendingForPattern(ctx, userID, memory.PatternKey)
		if err != nil {
			return nil, err
		}
		if exists {
			continue
		}
		due := time.Now().AddDate(0, 0, 1)
		drill := learning.Drill{
			UserID:          userID,
			MistakeMemoryID: memory.ID,
			PatternKey:      memory.PatternKey,
			Title:           memory.Title,
			Instruction:     instructionFor(memory),
			Status:          "pending",
			DueDate:         &due,
		}
		if err := s.repo.CreateDrill(ctx, &drill); err != nil {
			return nil, err
		}
		drills = append(drills, drill)
	}
	return drills, nil
}

func instructionFor(memory learning.MistakeMemory) string {
	title := strings.TrimSpace(memory.Title)
	if title == "" {
		title = "this pattern"
	}
	switch strings.ToLower(strings.TrimSpace(memory.Type)) {
	case "vocabulary":
		return fmt.Sprintf("Say 5 short sentences using stronger alternatives for %s.", title)
	case "pronunciation":
		return fmt.Sprintf("Record 5 short sentences and focus on pronouncing %s clearly.", title)
	default:
		return fmt.Sprintf("Say 5 sentences about yesterday using %s correctly.", title)
	}
}
