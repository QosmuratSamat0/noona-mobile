package user

import (
	"context"
	"errors"
	"net/mail"
	"strings"

	authDomain "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/auth"
	model "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/errs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/passwordUtils"
)

type UseCase struct {
	userRepo UserRepo
}

func NewUseCase(userRepo UserRepo) *UseCase {
	return &UseCase{
		userRepo: userRepo,
	}
}

func (uc *UseCase) CreateUser(
	ctx context.Context,
	requester *model.User,
	input CreateUserInput,
) error {
	if !authDomain.HasPermission(requester.Role, authDomain.AdminPermission) {
		return errs.ErrForbidden
	}

	if input.Name == "" || input.Email == "" || input.Password == "" {
		return errs.ErrInvalidInput
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if !isValidEmail(input.Email) {
		return errs.ErrInvalidEmail
	}

	if !model.IsValidRole(input.Role) {
		return errs.ErrInvalidRole
	}

	existingUser, err := uc.userRepo.GetUserByEmail(ctx, input.Email)
	if err != nil && !errors.Is(err, errs.ErrUserNotFound) {
		return err
	}
	if existingUser != nil {
		return errs.ErrEmailAlreadyExists
	}

	passwordHash, err := passwordUtils.HashPassword(input.Password)
	if err != nil {
		return err
	}

	user := &model.User{
		Username:     input.Name,
		Email:        input.Email,
		PasswordHash: passwordHash,
		Role:         input.Role,
	}

	return uc.userRepo.CreateUser(ctx, user)
}

func (uc *UseCase) GetAllUsers(
	ctx context.Context,
	requester *model.User,
) ([]*model.User, error) {
	if !authDomain.HasPermission(requester.Role, authDomain.AdminPermission) {
		return nil, errs.ErrForbidden
	}

	return uc.userRepo.GetAllUsers(ctx)
}

func (uc *UseCase) GetUserByID(
	ctx context.Context,
	requester *model.User,
	id string,
) (*model.User, error) {
	if id == "" {
		return nil, errs.ErrInvalidInput
	}

	hasManagePermission := authDomain.HasPermission(requester.Role, authDomain.AdminPermission)
	if !hasManagePermission && requester.ID != id {
		return nil, errs.ErrForbidden
	}

	return uc.userRepo.GetUserByID(ctx, id)
}

func (uc *UseCase) GetUserByEmail(
	ctx context.Context,
	email string,
) (*model.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, errs.ErrInvalidInput
	}

	return uc.userRepo.GetUserByEmail(ctx, email)
}

func (uc *UseCase) UpdateUser(
	ctx context.Context,
	requester *model.User,
	input UpdateUserInput,
) error {
	if input.ID == "" {
		return errs.ErrInvalidInput
	}

	hasManagePermission := authDomain.HasPermission(requester.Role, authDomain.AdminPermission)
	if !hasManagePermission && requester.ID != input.ID {
		return errs.ErrForbidden
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if input.Email != "" && !isValidEmail(input.Email) {
		return errs.ErrInvalidInput
	}

	existing, err := uc.userRepo.GetUserByID(ctx, input.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errs.ErrUserNotFound
	}

	if input.Name != "" {
		existing.Username = input.Name
	}
	if input.Email != "" {
		existing.Email = input.Email
	}
	if authDomain.HasPermission(requester.Role, authDomain.AdminPermission) && input.Role != "" && model.IsValidRole(input.Role) {
		existing.Role = input.Role
	}
	if input.CEFRLevel != "" {
		level := strings.ToUpper(strings.TrimSpace(input.CEFRLevel))
		if !isValidCEFRLevel(level) {
			return errs.ErrInvalidInput
		}
		existing.CEFRLevel = level
	}

	return uc.userRepo.UpdateUser(ctx, existing)
}

func (uc *UseCase) DeleteUser(
	ctx context.Context,
	requester *model.User,
	id string,
) error {
	if id == "" {
		return errs.ErrInvalidInput
	}

	hasManagePermission := authDomain.HasPermission(requester.Role, authDomain.AdminPermission)
	if !hasManagePermission && requester.ID != id {
		return errs.ErrForbidden
	}

	if hasManagePermission && requester.ID == id {
		return errs.ErrCannotDeleteSelf
	}

	userToDelete, err := uc.userRepo.GetUserByID(ctx, id)
	if err != nil {
		return err
	}
	if userToDelete == nil {
		return errs.ErrUserNotFound
	}

	if userToDelete.Role == model.RoleAdmin {
		adminCount, err := uc.userRepo.CountAdmins(ctx)
		if err != nil {
			return err
		}
		if adminCount <= 1 {
			return errs.ErrCannotDeleteLastAdmin
		}
	}

	return uc.userRepo.DeleteUser(ctx, id)
}

func (uc *UseCase) ChangeRole(
	ctx context.Context,
	requester *model.User,
	input ChangeRoleInput,
) error {
	if input.ID == "" {
		return errs.ErrInvalidInput
	}

	if !authDomain.HasPermission(requester.Role, authDomain.AdminPermission) {
		return errs.ErrForbidden
	}

	if input.Role == "" || !model.IsValidRole(input.Role) {
		return errs.ErrInvalidRole
	}

	existing, err := uc.userRepo.GetUserByID(ctx, input.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errs.ErrUserNotFound
	}

	if existing.Role == model.RoleAdmin && input.Role != model.RoleAdmin {
		adminCount, err := uc.userRepo.CountAdmins(ctx)
		if err != nil {
			return err
		}
		if adminCount <= 1 {
			return errs.ErrCannotDemoteLastAdmin
		}
	}

	existing.Role = input.Role
	return uc.userRepo.UpdateUser(ctx, existing)
}

func isValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}

func isValidCEFRLevel(level string) bool {
	switch level {
	case "A1", "A2", "B1", "B2", "C1", "C2":
		return true
	default:
		return false
	}
}
