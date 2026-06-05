package practice

import (
	"context"
	"io"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/results"
)

type STTService interface {
	TranscribeReader(ctx context.Context, audio io.Reader, language string) (string, error)
}

type AudioStorage interface {
	UploadFile(ctx context.Context, file io.Reader, fileSize int64, contentType, ext string) (string, error)
	FileURL(ctx context.Context, filePath string) (string, error)
}

type ResultService interface {
	CreateFromText(ctx context.Context, input results.CreateInput) (*learning.ResultView, error)
}
