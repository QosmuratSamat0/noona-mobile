package app

import (
	"context"

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
}
