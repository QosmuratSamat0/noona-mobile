package auth

type AuthTokens struct {
	AccessToken  string
	RefreshToken string
}

type RegisterInput struct {
	Username string
	Email    string
	Password string
}

type LoginInput struct {
	Email    string
	Password string
}

type CreateUserInput struct {
	Name         string
	Email        string
	PasswordHash string
	Role         string
}

func (input *RegisterInput) IsValid() bool {
	return input.Username != "" && input.Password != "" && input.Email != ""
}
