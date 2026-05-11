package app

import (
	"context"

	chatDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/chat"
	model "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
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
	SaveMessage(ctx context.Context, sessionID string, role chatDomain.Role, content string) (*chatDomain.Message, error)
	GetSessionMessages(ctx context.Context, sessionID string) ([]*chatDomain.Message, error)
}
