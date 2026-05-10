package user

import (
	"context"

	model "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
)

type UserRepo interface {
	CreateUser(ctx context.Context, user *model.User) error
	GetAllUsers(ctx context.Context) ([]*model.User, error)
	GetUserByID(ctx context.Context, id string) (*model.User, error)
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)
	UpdateUser(ctx context.Context, user *model.User) error
	DeleteUser(ctx context.Context, id string) error
	CountAdmins(ctx context.Context) (int, error)
}
