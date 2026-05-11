package app

import (
	_ "github.com/QosmuratSamat0/Noona-AI/backend/docs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger"

	activityModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/activity"
	authModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/auth"
	chatModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/chat"
	linguisticModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/linguistic"
	userModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/user"

	activityRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/activity/postgres"
	authRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/auth/postgres"
	chatRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/chat/postgres"
	linguisticRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/linguistic/postgres"
	userRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/user/postgres"

	activityUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/activity"
	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
	chatUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/chat"
	linguisticUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/linguistic"
	userUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/user"
)

type Deps struct {
	Config            *config.Config
	DB                *pgxpool.Pool
	UserUseCase       UserUseCase
	AuthUseCase       AuthUseCase
	ChatUseCase       ChatUseCase
	LinguisticUseCase LinguisticUseCase
	ActivityUseCase   ActivityUseCase
}

func BuildDeps(db *pgxpool.Pool, cfg *config.Config) (*Deps, error) {
	// Repositories
	userRepo := userRepo.New(db)
	authRepo := authRepo.New(db)
	chatRepo := chatRepo.New(db)
	linguisticRepo := linguisticRepo.New(db)
	activityRepo := activityRepo.New(db)

	// UseCases
	userUseCase := userUseCase.NewUseCase(userRepo)
	authUseCase := authUseCase.NewUseCase(userRepo, authRepo, cfg.JWTSecret)
	chatUseCase := chatUseCase.NewUseCase(chatRepo)
	linguisticUseCase := linguisticUseCase.NewUseCase(linguisticRepo)
	activityUseCase := activityUseCase.NewUseCase(activityRepo)

	return &Deps{
		Config:            cfg,
		DB:                db,
		UserUseCase:       userUseCase,
		AuthUseCase:       authUseCase,
		ChatUseCase:       chatUseCase,
		LinguisticUseCase: linguisticUseCase,
		ActivityUseCase:   activityUseCase,
	}, nil
}

func BuildHTTPModules(router chi.Router, deps *Deps) {
	userMod := userModule.NewUserModule(deps.UserUseCase)
	chatMod := chatModule.NewChatModule(deps.ChatUseCase)
	linguisticMod := linguisticModule.NewLinguisticModule(deps.LinguisticUseCase)
	activityMod := activityModule.NewActivityModule(deps.ActivityUseCase)
	router.Get("/docs/*", httpSwagger.WrapHandler)

	router.Route("/api/v1", func(r chi.Router) {
		authMod := authModule.NewAuthModule(deps.AuthUseCase)
		authMod.RegisterRoutes(r)

		r.Group(func(r chi.Router) {
			userMod.RegisterRoutes(r, deps.Config.JWTSecret)
			chatMod.RegisterRoutes(r, deps.Config.JWTSecret)
			linguisticMod.RegisterRoutes(r, deps.Config.JWTSecret)
			activityMod.RegisterRoutes(r, deps.Config.JWTSecret)
		})
	})
}
