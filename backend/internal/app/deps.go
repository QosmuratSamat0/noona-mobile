package app

import (
	_ "github.com/QosmuratSamat0/Noona-AI/backend/docs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger"

	authModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/auth"
	chatModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/chat"
	userModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/user"

	authRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/auth/postgres"
	chatRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/chat/postgres"
	userRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/user/postgres"

	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
	chatUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/chat"
	userUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/user"
)

type Deps struct {
	Config      *config.Config
	DB          *pgxpool.Pool
	UserUseCase UserUseCase
	AuthUseCase AuthUseCase
	ChatUseCase ChatUseCase
}

func BuildDeps(db *pgxpool.Pool, cfg *config.Config) (*Deps, error) {
	// Repositories
	userRepo := userRepo.New(db)
	authRepo := authRepo.New(db)
	chatRepo := chatRepo.New(db)

	// UseCases
	userUseCase := userUseCase.NewUseCase(userRepo)
	authUseCase := authUseCase.NewUseCase(userRepo, authRepo, cfg.JWTSecret)
	chatUseCase := chatUseCase.NewUseCase(chatRepo)

	return &Deps{
		Config:      cfg,
		DB:          db,
		UserUseCase: userUseCase,
		AuthUseCase: authUseCase,
		ChatUseCase: chatUseCase,
	}, nil
}

func BuildHTTPModules(router chi.Router, deps *Deps) {
	userMod := userModule.NewUserModule(deps.UserUseCase)
	chatMod := chatModule.NewChatModule(deps.ChatUseCase)
	router.Get("/docs/*", httpSwagger.WrapHandler)

	router.Route("/api/v1", func(r chi.Router) {
		authMod := authModule.NewAuthModule(deps.AuthUseCase)
		authMod.RegisterRoutes(r)

		r.Group(func(r chi.Router) {
			userMod.RegisterRoutes(r, deps.Config.JWTSecret)
			chatMod.RegisterRoutes(r, deps.Config.JWTSecret)
		})
	})
}
