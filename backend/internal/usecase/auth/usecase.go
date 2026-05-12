package auth

import (
	"context"
	"errors"
	"net/mail"
	"time"

	userDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/passwordUtils"
	token "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/tokens"
)

type UseCase struct {
	UserRepo  UserRepo
	TokenRepo TokenRepo
	Secret    string
}

func NewUseCase(userRepo UserRepo, tokenRepo TokenRepo, secret string) *UseCase {
	return &UseCase{
		UserRepo:  userRepo,
		TokenRepo: tokenRepo,
		Secret:    secret,
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

func (uc *UseCase) Login(ctx context.Context, input LoginInput) (*AuthTokens, error) {
	if input.Email == "" || input.Password == "" {
		return nil, errs.ErrInvalidInput
	}

	user, err := uc.UserRepo.GetUserByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errs.ErrInvalidCredentials
	}

	if err := passwordUtils.CheckPassword(user.PasswordHash, input.Password); err != nil {
		return nil, errs.ErrInvalidCredentials
	}

	accessToken, err := uc.GenerateAccessToken(ctx, user.ID, string(user.Role))
	if err != nil {
		return nil, err
	}

	refreshToken, err := uc.GenerateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	tokens := &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}

	return tokens, nil
}

func (uc *UseCase) Logout(ctx context.Context, refreshToken string) error {
	_, err := uc.TokenRepo.DeleteRefreshToken(ctx, refreshToken)
	if err != nil {
		return err
	}
	return nil
}

func (uc *UseCase) Refresh(ctx context.Context, refreshToken string) (*AuthTokens, error) {
	userID, err := uc.TokenRepo.DeleteRefreshToken(ctx, refreshToken)
	if err != nil {
		if errors.Is(err, errs.ErrNotFound) {
			return nil, errs.ErrUnauthorized
		}
		return nil, err
	}

	user, err := uc.UserRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errs.ErrUnauthorized
	}

	accessToken, err := uc.GenerateAccessToken(ctx, user.ID, string(user.Role))
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := uc.GenerateRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

func (uc *UseCase) GenerateAccessToken(ctx context.Context, userID string, role string) (string, error) {
	accessToken, err := token.GenerateJWT(
		uc.Secret,
		userID,
		role,
		15*time.Minute,
	)
	if err != nil {
		return "", err
	}
	return accessToken, nil
}

func (uc *UseCase) GenerateRefreshToken(ctx context.Context, userID string) (string, error) {
	newRefreshToken, err := token.GenerateRefreshToken()
	if err != nil {
		return "", err
	}

	err = uc.TokenRepo.SaveRefreshToken(
		ctx,
		newRefreshToken,
		userID,
		time.Now().Add(30*24*time.Hour),
	)
	if err != nil {
		return "", err
	}
	return newRefreshToken, nil
}

func isValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}
