package main

import (
	"log/slog"
	"os"

	_ "github.com/QosmuratSamat0/Noona-AI/backend/docs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/app"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	slogpretty "github.com/QosmuratSamat0/Noona-AI/backend/internal/lib/logger"
	"github.com/joho/godotenv"
)

const (
	envLocal = "local"
	envProd  = "prod"
	envDev   = "dev"
)

// @title Smart Campus API
// @version 1.0
// @description API for Smart Campus Project
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

func main() {
	if err := godotenv.Load(); err != nil {
		slog.Warn("No .env file found")
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	log := setupLogger(cfg.Env)

	log.Info("starting handler")

	app, err := app.NewApp(cfg, log)
	if err != nil {
		log.Error("failed to initialize app", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := app.Run(); err != nil {
		log.Error("app encountered an error", "error", err)
		os.Exit(1)
	}

}

func setupLogger(env string) *slog.Logger {
	var log *slog.Logger

	switch env {
	case envLocal:
		log = setupPrettyLogger()
	case envProd:
		log = slog.New(
			slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}),
		)
	case envDev:
		log = slog.New(
			slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}),
		)
	}

	return log
}

func setupPrettyLogger() *slog.Logger {
	opts := slogpretty.PrettyHandlerOptions{
		SlogOpts: &slog.HandlerOptions{Level: slog.LevelDebug},
	}
	handler := opts.NewPrettyHandler(os.Stdout)

	return slog.New(handler)
}
