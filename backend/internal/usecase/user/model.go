package user

import (
	model "github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/user"
)

type CreateUserInput struct {
	Name     string
	Email    string
	Password string
	Role     model.Role
}

type UpdateUserInput struct {
	ID    string
	Name  string
	Email string
	Role  model.Role
}

type ChangeRoleInput struct {
	ID   string
	Role model.Role
}
