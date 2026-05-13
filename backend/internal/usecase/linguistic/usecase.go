package linguistic

import (
	"context"

	domain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/linguistic"
)

type UseCase struct {
	repo LinguisticRepo
}

func NewUseCase(repo LinguisticRepo) *UseCase {
	return &UseCase{repo: repo}
}

func (uc *UseCase) SaveTranscript(ctx context.Context, messageID, rawText string) (*domain.Transcript, error) {
	t := &domain.Transcript{
		MessageID: messageID,
		RawText:   rawText,
	}
	err := uc.repo.SaveTranscript(ctx, t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (uc *UseCase) GetTranscript(ctx context.Context, userID string, messageID string) (*domain.Transcript, error) {
	return uc.repo.GetTranscriptByMessageID(ctx, messageID, userID)
}

func (uc *UseCase) SaveCorrection(ctx context.Context, transcriptID, correctedText, explanation, cefrLevel string) (*domain.Correction, error) {
	c := &domain.Correction{
		TranscriptID:  transcriptID,
		CorrectedText: correctedText,
		Explanation:   explanation,
		CEFRLevel:     cefrLevel,
	}
	err := uc.repo.SaveCorrection(ctx, c)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (uc *UseCase) GetCorrections(ctx context.Context, transcriptID string) ([]*domain.Correction, error) {
	return uc.repo.GetCorrectionsByTranscriptID(ctx, transcriptID)
}

func (uc *UseCase) SaveMistake(ctx context.Context, userID, mistakeType, original, corrected string, offset int) (*domain.MistakeModel, error) {
	m := domain.MistakeModel{
		UserID:    userID,
		Type:      mistakeType,
		Original:  original,
		Corrected: corrected,
		OffsetPos: offset,
	}
	err := uc.repo.CreateMistake(ctx, m)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (uc *UseCase) GetUserMistakes(ctx context.Context, userID string) ([]*domain.MistakeModel, error) {
	return uc.repo.GetMistakesByUserID(ctx, userID)
}
