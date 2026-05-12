package errs

import "errors"

var (
	// General
	ErrInternalServerError = errors.New("internal server error")
	ErrNotFound            = errors.New("not found")
	ErrUnauthorized        = errors.New("unauthorized")
	ErrBadRequest          = errors.New("bad request")
	ErrForbidden           = errors.New("forbidden")
	ErrAlreadyExists       = errors.New("already exists")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrInvalidInput        = errors.New("invalid input")
	ErrInvalidRole         = errors.New("invalid role")

	ErrInvalidEmail = errors.New("invalid email")
	ErrUserNotFound = errors.New("user not found")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrCannotDeleteSelf = errors.New("cannot delete self")
	ErrCannotDeleteLastAdmin = errors.New("cannot delete last admin")
	ErrCannotDemoteLastAdmin = errors.New("cannot demote last admin")
	
	// Chat
	ErrSessionNotFound = errors.New("chat session not found")
	ErrSessionAccessDenied = errors.New("access denied to chat session")
)
