package app

import (
	"context"
	"fmt"
	"strings"

	_ "github.com/QosmuratSamat0/Noona-AI/backend/docs"
	"github.com/QosmuratSamat0/Noona-AI/backend/internal/config"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger"

	wsHub "github.com/QosmuratSamat0/Noona-AI/backend/internal/chat"
	activityModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/activity"
	audioModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/audio"
	authModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/auth"
	chatModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/chat"
	learningModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/learning"
	linguisticModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/linguistic"
	userModule "github.com/QosmuratSamat0/Noona-AI/backend/internal/delivery/http/user"

	gemini "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/ai/llm/gemini"
	groqLLM "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/ai/llm/groq"
	openrouterLLM "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/ai/llm/openrouter"
	sttClient "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/ai/stt"
	ttsClient "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/ai/tts"

	activityRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/activity/postgres"
	audioMinioRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/audio/minio"
	audioRedisRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/audio/redis"
	authRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/auth/postgres"
	chatRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/chat/postgres"
	learningRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/learning/postgres"
	userRepo "github.com/QosmuratSamat0/Noona-AI/backend/internal/infrastructure/repository/user/postgres"

	activityUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/activity"
	analysisUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/analysis"
	audioUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/audio"
	authUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/auth"
	chatUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/chat"
	dailyUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/daily"
	drillsUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/drills"
	linguisticUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/linguistic"
	mistakeMemoryUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/mistake_memory"
	practiceUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/practice"
	resultsUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/results"
	userUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/user"
	vocabularyUseCase "github.com/QosmuratSamat0/Noona-AI/backend/internal/usecase/vocabulary"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/worker"
	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
)

type Deps struct {
	Config               *config.Config
	DB                   *pgxpool.Pool
	UserUseCase          UserUseCase
	AuthUseCase          AuthUseCase
	ChatUseCase          ChatUseCase
	LinguisticUseCase    LinguisticUseCase
	ActivityUseCase      ActivityUseCase
	AudioUseCase         AudioUseCase
	PracticeUseCase      PracticeUseCase
	ResultsUseCase       ResultsUseCase
	DailyUseCase         DailyUseCase
	MistakeMemoryUseCase MistakeMemoryUseCase
	VocabularyUseCase    VocabularyUseCase
	AnalysisUseCase      AnalysisUseCase
	AudioWorker          *worker.AudioWorker
	Hub                  *wsHub.Hub
	Redis                *redis.Client
	GeminiProvider       *gemini.GeminiProvider
}

func BuildDeps(db *pgxpool.Pool, minioClient *minio.Client, redisClient *redis.Client, hub *wsHub.Hub, cfg *config.Config) (*Deps, error) {
	// Repositories
	userRepo := userRepo.New(db, redisClient)
	authRepo := authRepo.New(db)
	chatRepo := chatRepo.New(db, redisClient)
	activityRepo := activityRepo.New(db, redisClient)
	learningStore := learningRepo.New(db)

	audioStorage := audioMinioRepo.NewStorageRepo(
		minioClient,
		"voice-input",
		cfg.MinioPublicEndpoint,
		cfg.MinioAccessKeyID,
		cfg.MinioSecretAccessKey,
		cfg.MinioUseSSL,
	)
	audioJob := audioRedisRepo.NewJobRepo(redisClient, cfg.AudioWorkerQueue)

	// UseCases
	userUC := userUseCase.NewUseCase(userRepo)
	authUC := authUseCase.NewUseCase(userRepo, authRepo, cfg.JWTSecret)
	activityUC := activityUseCase.NewUseCase(activityRepo)
	linguisticUC := linguisticUseCase.NewUseCase()
	chatUC := chatUseCase.NewUseCase(chatRepo, activityUC, userRepo)

	// AI infrastructure — gRPC client calls Python faster-whisper service
	var stt audioUseCase.STTService
	switch strings.ToLower(strings.TrimSpace(cfg.STTProvider)) {
	case "", "grpc", "local", "faster-whisper":
		localSTT, err := sttClient.NewGRPCClient(
			cfg.STTGRPCAddr,
			minioClient,
			"voice-input",
			cfg.STTRequestTimeout,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize stt grpc client: %w", err)
		}
		stt = localSTT
	case "groq":
		groqSTT, err := sttClient.NewGroqClient(
			cfg.GroqAPIKey,
			cfg.GroqSTTURL,
			cfg.GroqSTTModel,
			minioClient,
			"voice-input",
			cfg.STTRequestTimeout,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize groq stt client: %w", err)
		}
		stt = groqSTT
	default:
		return nil, fmt.Errorf("unknown STT_PROVIDER %q; use grpc or groq", cfg.STTProvider)
	}

	// TTS infrastructure — gRPC client calls Python Piper service
	tts, err := ttsClient.NewGRPCClient(cfg.TTSGRPCAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tts grpc client: %w", err)
	}

	// LLM provider for chat replies and linguistic feedback.
	var llm audioUseCase.LLMProvider
	var geminiProvider *gemini.GeminiProvider
	switch strings.ToLower(strings.TrimSpace(cfg.LLMProvider)) {
	case "", "gemini":
		var err error
		geminiProvider, err = gemini.NewGeminiProvider(context.Background(), cfg.GeminiAPIKey, cfg.GeminiModel)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize gemini provider: %w", err)
		}
		llm = geminiProvider
	case "groq":
		groqProvider, err := groqLLM.NewProvider(cfg.GroqAPIKey, cfg.GroqLLMURL, cfg.GroqLLMModel)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize groq llm provider: %w", err)
		}
		llm = groqProvider
	case "openrouter":
		openrouterProvider, err := openrouterLLM.NewProvider(
			cfg.OpenRouterAPIKey,
			cfg.OpenRouterLLMURL,
			cfg.OpenRouterLLMModel,
			cfg.OpenRouterReferer,
			cfg.OpenRouterAppTitle,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize openrouter llm provider: %w", err)
		}
		llm = openrouterProvider
	default:
		return nil, fmt.Errorf("unknown LLM_PROVIDER %q; use gemini, groq, or openrouter", cfg.LLMProvider)
	}
	linguisticUC = linguisticUseCase.NewUseCase(llm)
	chatUC = chatUseCase.NewUseCase(chatRepo, activityUC, llm, userRepo).WithTTS(tts)

	audioUC := audioUseCase.NewLowLatencyUseCase(
		audioStorage,
		audioJob,
		chatRepo,
		userRepo,
		activityUC,
		stt,
		llm,
		tts,
		hub,
	)

	mistakeMemoryUC := mistakeMemoryUseCase.NewService(learningStore)
	vocabularyUC := vocabularyUseCase.NewService(learningStore)
	dailyUC := dailyUseCase.NewService(learningStore)
	drillsUC := drillsUseCase.NewService(learningStore)
	resultsUC := resultsUseCase.NewService(learningStore, llm, mistakeMemoryUC, drillsUC, vocabularyUC, dailyUC, activityUC)
	practiceUC := practiceUseCase.NewService(stt, audioStorage, resultsUC)
	analysisUC := analysisUseCase.NewService(mistakeMemoryUC, vocabularyUC, dailyUC)

	// AudioProcessor orchestrates STT → LLM → TTS pipeline.
	processor := audioUseCase.NewAudioProcessor(stt, llm, tts, hub)

	// Worker pool — picks jobs from Redis queue and runs processor.
	audioWorker := worker.NewAudioWorker(
		redisClient,
		processor,
		cfg.AudioWorkerQueue,
		cfg.AudioWorkerCount,
	)

	return &Deps{
		Config:               cfg,
		DB:                   db,
		UserUseCase:          userUC,
		AuthUseCase:          authUC,
		ChatUseCase:          chatUC,
		LinguisticUseCase:    linguisticUC,
		ActivityUseCase:      activityUC,
		AudioUseCase:         audioUC,
		PracticeUseCase:      practiceUC,
		ResultsUseCase:       resultsUC,
		DailyUseCase:         dailyUC,
		MistakeMemoryUseCase: mistakeMemoryUC,
		VocabularyUseCase:    vocabularyUC,
		AnalysisUseCase:      analysisUC,
		AudioWorker:          audioWorker,
		Hub:                  hub,
		Redis:                redisClient,
		GeminiProvider:       geminiProvider,
	}, nil
}

func BuildHTTPModules(router chi.Router, deps *Deps) {
	userMod := userModule.NewUserModule(deps.UserUseCase)
	chatMod := chatModule.NewChatModule(deps.ChatUseCase, deps.Hub)
	linguisticMod := linguisticModule.NewLinguisticModule(deps.LinguisticUseCase)
	activityMod := activityModule.NewActivityModule(deps.ActivityUseCase)
	audioMod := audioModule.NewAudioModule(deps.AudioUseCase)
	learningMod := learningModule.NewLearningModule(
		deps.PracticeUseCase,
		deps.DailyUseCase,
		deps.ResultsUseCase,
		deps.MistakeMemoryUseCase,
		deps.VocabularyUseCase,
		deps.AnalysisUseCase,
	)
	router.Get("/docs/*", httpSwagger.WrapHandler)

	router.Route("/api/v1", func(r chi.Router) {
		authMod := authModule.NewAuthModule(deps.AuthUseCase)
		authMod.RegisterRoutes(r)

		r.Group(func(r chi.Router) {
			userMod.RegisterRoutes(r, deps.Config.JWTSecret)
			chatMod.RegisterRoutes(r, deps.Config.JWTSecret)
			linguisticMod.RegisterRoutes(r, deps.Config.JWTSecret)
			activityMod.RegisterRoutes(r, deps.Config.JWTSecret)
			audioMod.RegisterRoutes(r, deps.Config.JWTSecret)
			learningMod.RegisterRoutes(r, deps.Config.JWTSecret)
		})
	})
}
