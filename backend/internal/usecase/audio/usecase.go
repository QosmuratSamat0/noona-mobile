package audio

import (
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/audio"
	"github.com/google/uuid"
)

type UseCase struct {
	storage    StorageRepo
	jobRepo    JobRepo
	activityUC ActivityUseCase
}

func NewUseCase(storage StorageRepo, jobRepo JobRepo, activityUC ActivityUseCase) *UseCase {
	return &UseCase{
		storage:    storage,
		jobRepo:    jobRepo,
		activityUC: activityUC,
	}
}

func (uc *UseCase) UploadAudio(ctx context.Context, userID string, file io.Reader, fileSize int64, contentType, ext string) (string, error) {
	filePath, err := uc.storage.UploadFile(ctx, file, fileSize, contentType, ext)
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	jobID := uuid.New().String()

	job := audio.Job{
		JobID:    jobID,
		UserID:   userID,
		FilePath: filePath,
	}

	if err := uc.jobRepo.CreateJob(ctx, job); err != nil {
		return "", fmt.Errorf("failed to create job: %w", err)
	}

	// Record activity
	if err := uc.activityUC.RecordActivity(ctx, userID); err != nil {
		slog.Error("failed to record activity on audio upload", "error", err, "user_id", userID)
	}

	return jobID, nil
}
