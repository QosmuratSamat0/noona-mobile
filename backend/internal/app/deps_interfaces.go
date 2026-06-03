package app

import (
	"context"
	"io"
	"time"

	activityDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/activity"
	chatDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	learningDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	model "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
	chatUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/chat"
	dailyUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/daily"
	practiceUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/practice"
	resultsUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/results"
	userUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/user"
)

type UserUseCase interface {
	CreateUser(ctx context.Context, requester *model.User, input userUseCase.CreateUserInput) error
	GetAllUsers(ctx context.Context, requester *model.User) ([]*model.User, error)
	GetUserByID(ctx context.Context, requester *model.User, id string) (*model.User, error)
	UpdateUser(ctx context.Context, requester *model.User, input userUseCase.UpdateUserInput) error
	DeleteUser(ctx context.Context, requester *model.User, id string) error
}

type AuthUseCase interface {
	Register(ctx context.Context, input authUseCase.RegisterInput) error
	Login(ctx context.Context, input authUseCase.LoginInput) (*authUseCase.AuthTokens, error)
	Refresh(ctx context.Context, refreshToken string) (*authUseCase.AuthTokens, error)
	Logout(ctx context.Context, refreshToken string) error
}

type ChatUseCase interface {
	CreateSession(ctx context.Context, userID string) (*chatDomain.Session, error)
	GetUserSessions(ctx context.Context, userID string) ([]*chatDomain.Session, error)
	SaveMessage(ctx context.Context, userID string, sessionID string, role chatDomain.Role, content string) (*chatDomain.Message, error)
	SendMessageWithReply(ctx context.Context, userID string, sessionID string, content string) (*chatUseCase.SendMessageResult, error)
	GetSessionMessages(ctx context.Context, userID string, sessionID string) ([]*chatDomain.Message, error)
}

type LinguisticUseCase interface {
	Translate(ctx context.Context, text, targetLang string) (string, error)
}

type ActivityUseCase interface {
	RecordActivity(ctx context.Context, userID string) error
	GetActivity(ctx context.Context, userID string) (*activityDomain.Streak, []*activityDomain.DailyStat, error)
}

type AudioUseCase interface {
	UploadAudio(ctx context.Context, userID, sessionID string, file io.Reader, fileSize int64, contentType, ext string) (string, error)
}

type PracticeUseCase interface {
	SubmitText(ctx context.Context, input practiceUseCase.TextInput) (*learningDomain.ResultView, error)
	SubmitAudio(ctx context.Context, input practiceUseCase.AudioInput) (*learningDomain.ResultView, error)
}

type ResultsUseCase interface {
	CreateFromText(ctx context.Context, input resultsUseCase.CreateInput) (*learningDomain.ResultView, error)
	Get(ctx context.Context, userID, resultID string) (*learningDomain.ResultView, error)
	List(ctx context.Context, userID, sessionID string) ([]learningDomain.Result, error)
}

type DailyUseCase interface {
	Start(ctx context.Context, userID string) (*learningDomain.DailySession, error)
	Finish(ctx context.Context, userID, sessionID string) (*learningDomain.DailySession, error)
	Today(ctx context.Context, userID string) (*learningDomain.DailySession, error)
	ByDate(ctx context.Context, userID string, date time.Time) (*learningDomain.DailySession, error)
	EnsureSession(ctx context.Context, userID, sessionID string) (*learningDomain.DailySession, error)
	ApplyResult(ctx context.Context, sessionID string, metrics dailyUseCase.ResultMetrics) error
}

type MistakeMemoryUseCase interface {
	UpsertFromMistakes(ctx context.Context, userID string, mistakes []learningDomain.Mistake) ([]learningDomain.MistakeMemory, error)
	ListSummary(ctx context.Context, userID string) (*learningDomain.MemorySummary, error)
}

type VocabularyUseCase interface {
	TrackTranscript(ctx context.Context, userID, resultID, transcriptID, text string) (learningDomain.VocabularyStats, error)
	GetToday(ctx context.Context, userID string) (learningDomain.VocabularyStats, error)
}

type AnalysisUseCase interface {
	GetMine(ctx context.Context, userID string) (*learningDomain.AnalysisSummary, error)
}
