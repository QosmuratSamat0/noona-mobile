package auth

import (
	"context"
	"net/mail"

	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/passwordUtils"
)

type UseCase struct {
	UserRepo  UserRepo
	TokenRepo TokenRepo
}

func NewUseCase(userRepo UserRepo, tokenRepo TokenRepo) *UseCase {
	return &UseCase{
		UserRepo:  userRepo,
		TokenRepo: tokenRepo,
	}
}

func (uc *UseCase) Register(ctx context.Context, input RegisterInput) error {

	exists, err := uc.UserRepo.GetUserByEmail(ctx, input.Email)
	if err != nil {
		return err
	}
	if exists != nil {
		return errs.ErrAlreadyExists
	}

	if !input.IsValid() {
		return errs.ErrInvalidInput
	}

	if !isValidEmail(input.Email) {
		return errs.ErrInvalidInput
	}

	passwordHash, err := passwordUtils.HashPassword(input.Password)
	if err != nil {
		return errs.ErrInvalidCredentials
	}

	user := &userDomain.User{
		Username:     input.Username,
		Email:        input.Email,
		PasswordHash: passwordHash,
		Role:         userDomain.RoleUser,
	}

	err = uc.UserRepo.CreateUser(ctx, user)

	if err != nil {
		return err
	}

	return nil
}

func isValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}
