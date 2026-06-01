package config

import (
	"time"

	"github.com/caarlos0/env/v9"
)

type Config struct {
	Env                  string        `env:"ENV" envDefault:"local"`
	DatabaseURL          string        `env:"DATABASE_URL"`
	JWTSecret            string        `env:"JWT_SECRET"`
	RedisURL             string        `env:"REDIS_URL" envDefault:"localhost:6379"`
	MinioEndpoint        string        `env:"MINIO_ENDPOINT" envDefault:"localhost:9000"`
	MinioPublicEndpoint  string        `env:"MINIO_PUBLIC_ENDPOINT"`
	MinioAccessKeyID     string        `env:"MINIO_ACCESS_KEY_ID" envDefault:"minioadmin"`
	MinioSecretAccessKey string        `env:"MINIO_SECRET_ACCESS_KEY" envDefault:"minioadmin"`
	MinioUseSSL          bool          `env:"MINIO_USE_SSL" envDefault:"false"`
	STTServiceURL        string        `env:"STT_SERVICE_URL" envDefault:"http://localhost:8001"`
	STTProvider          string        `env:"STT_PROVIDER" envDefault:"grpc"`
	STTGRPCAddr          string        `env:"STT_GRPC_ADDR" envDefault:"localhost:50051"`
	STTRequestTimeout    time.Duration `env:"STT_REQUEST_TIMEOUT" envDefault:"10m"`
	GroqAPIKey           string        `env:"GROQ_API_KEY"`
	GroqSTTURL           string        `env:"GROQ_STT_URL" envDefault:"https://api.groq.com/openai/v1/audio/transcriptions"`
	GroqSTTModel         string        `env:"GROQ_STT_MODEL" envDefault:"whisper-large-v3-turbo"`
	LLMProvider          string        `env:"LLM_PROVIDER" envDefault:"gemini"`
	GroqLLMURL           string        `env:"GROQ_LLM_URL" envDefault:"https://api.groq.com/openai/v1/chat/completions"`
	GroqLLMModel         string        `env:"GROQ_LLM_MODEL" envDefault:"llama-3.3-70b-versatile"`
	OpenRouterAPIKey     string        `env:"OPENROUTER_API_KEY"`
	OpenRouterLLMURL     string        `env:"OPENROUTER_LLM_URL" envDefault:"https://openrouter.ai/api/v1/chat/completions"`
	OpenRouterLLMModel   string        `env:"OPENROUTER_LLM_MODEL" envDefault:"openai/gpt-4o-mini"`
	OpenRouterReferer    string        `env:"OPENROUTER_HTTP_REFERER"`
	OpenRouterAppTitle   string        `env:"OPENROUTER_APP_TITLE" envDefault:"Noona AI"`
	TTSServiceURL        string        `env:"TTS_SERVICE_URL" envDefault:"http://localhost:8002"`
	TTSGRPCAddr          string        `env:"TTS_GRPC_ADDR" envDefault:"localhost:50052"`
	TTSRequestTimeout    time.Duration `env:"TTS_REQUEST_TIMEOUT" envDefault:"120s"`
	GeminiAPIKey         string        `env:"GEMINI_API_KEY"`
	GeminiModel          string        `env:"GEMINI_MODEL" envDefault:"gemini-2.5-flash"`
	AudioWorkerQueue     string        `env:"AUDIO_WORKER_QUEUE" envDefault:"audio:jobs"`
	AudioWorkerCount     int           `env:"AUDIO_WORKER_COUNT" envDefault:"2"`
	HTTPServer           HTTPServer
}

type HTTPServer struct {
	Address     string        `env:"ADDRESS" envDefault:"0.0.0.0:8080"`
	Timeout     time.Duration `env:"TIMEOUT" envDefault:"15s"`
	IdleTimeout time.Duration `env:"IDLE_TIMEOUT" envDefault:"60s"`
}

func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
