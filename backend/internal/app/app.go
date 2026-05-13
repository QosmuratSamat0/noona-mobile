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

	wsHub "github.com/QosmuratSamat0/Noona-AI/backend/internal/chat"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	infraStorage "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/storage"
	"github.com/QosmuratSamat0/Noona-AI/backend/pkg/storage"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
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

	minioStorage, err := storage.NewMinioClient(cfg.MinioEndpoint, cfg.MinioAccessKeyID, cfg.MinioSecretAccessKey, cfg.MinioUseSSL)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize minio client: %w", err)
	}

	if err := infraStorage.InitStorage(minioStorage); err != nil {
		return nil, fmt.Errorf("failed to bootstrap storage buckets: %w", err)
	}

	minioClient := minioStorage.Client()

	redisClient := redis.NewClient(&redis.Options{
		Addr: cfg.RedisURL,
	})
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	hub := wsHub.NewHub()

	deps, err := BuildDeps(dbpool, minioClient, redisClient, hub, cfg)

	if err != nil {
		return nil, fmt.Errorf("failed to build deps: %w", err)
	}

	// Start the audio worker pool
	deps.AudioWorker.Start()

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

	// Drain the worker pool gracefully
	if a.deps.AudioWorker != nil {
		log.Println("Stopping audio worker pool...")
		a.deps.AudioWorker.Stop()
	}

	if a.deps.DB != nil {
		log.Println("Closing database...")
		a.deps.DB.Close()
	}

	if a.deps.Redis != nil {
		log.Println("Closing redis...")
		_ = a.deps.Redis.Close()
	}

	if a.deps.GeminiProvider != nil {
		log.Println("Closing Gemini provider...")
		_ = a.deps.GeminiProvider.Close()
	}

	log.Println("Shutdown complete")

	return nil
}
