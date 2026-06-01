package user

import "time"

type Role string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

type User struct {
	ID             string    `json:"id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	PasswordHash   string    `json:"password,omitempty"`
	Role           Role      `json:"role"`
	CEFRLevel      string    `json:"cefr_level"`
	NativeLanguage string    `json:"native_language"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

func IsValidRole(role Role) bool {
	switch role {
	case RoleAdmin, RoleUser:
		return true
	default:
		return false
	}
}
