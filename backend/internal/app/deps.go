package app

import (
	_ "github.com/QosmuratSamat0/Noona-AI/backend/docs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger"

	authModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/auth"
	userModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/user"

	authRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/auth/postgres"
	userRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/user/postgres"

	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
	userUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/user"
)

type Deps struct {
	Config      *config.Config
	DB          *pgxpool.Pool
	UserUseCase *userUseCase.UseCase
	AuthUseCase *authUseCase.UseCase
}

func BuildDeps(db *pgxpool.Pool, cfg *config.Config) (*Deps, error) {
	// Repositories
	userRepo := userRepo.New(db)
	authRepo := authRepo.New(db)

	// UseCases
	userUseCase := userUseCase.NewUseCase(userRepo)
	authUseCase := authUseCase.NewUseCase(userRepo, authRepo)

	return &Deps{
		Config:      cfg,
		DB:          db,
		UserUseCase: userUseCase,
		AuthUseCase: authUseCase,
	}, nil
}

func BuildHTTPModules(router chi.Router, deps *Deps) {
	userMod := userModule.NewUserModule(deps.UserUseCase)
	router.Get("/docs/*", httpSwagger.WrapHandler)

	router.Route("/api/v1", func(r chi.Router) {
		authMod := authModule.NewAuthModule(deps.AuthUseCase)
		authMod.RegisterRoutes(r)

		r.Group(func(r chi.Router) {
			userMod.RegisterRoutes(r, deps.Config.JWTSecret)
		})
	})
}
