package app

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	httpServer *http.Server
	deps       *Deps
}

func NewApp(cfg *config.Config, logger *slog.Logger) (*App, error) {

	dbpool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w, url: %s", err, cfg.DatabaseURL)
	}

	logger.Info("Database connected")

	deps, err := BuildDeps(dbpool, cfg)

	if err != nil {
		return nil, fmt.Errorf("failed to build deps: %w", err)
	}

	router := chi.NewRouter()

	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(middleware.RequestID)

	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	BuildHTTPModules(router, deps)

	server := &http.Server{
		Addr:         cfg.HTTPServer.Address,
		Handler:      router,
		ReadTimeout:  cfg.HTTPServer.Timeout,
		WriteTimeout: cfg.HTTPServer.Timeout,
		IdleTimeout:  cfg.HTTPServer.IdleTimeout,
	}

	return &App{
		httpServer: server,
		deps:       deps,
	}, nil
}

func (a *App) Run() error {
	serverErr := make(chan error, 1)

	go func() {
		log.Println("HTTP server started on", a.httpServer.Addr)
		if err := a.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(stop)

	select {
	case err := <-serverErr:
		return err

	case sig := <-stop:
		log.Println("shutdown signal received:", sig)
	}

	return a.Shutdown()
}

func (a *App) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	log.Println("Shutting down HTTP server...")

	if err := a.httpServer.Shutdown(ctx); err != nil {
		return err
	}

	if a.deps.DB != nil {
		log.Println("Closing database...")
		a.deps.DB.Close()
	}

	log.Println("Shutdown complete")

	return nil
}
