package config

import (
	"time"

	"github.com/caarlos0/env/v9"
)

type Config struct {
	Env                  string `env:"ENV" envDefault:"local"`
	DatabaseURL          string `env:"DATABASE_URL"`
	JWTSecret            string `env:"JWT_SECRET"`
	RedisURL             string `env:"REDIS_URL" envDefault:"localhost:6379"`
	MinioEndpoint        string `env:"MINIO_ENDPOINT" envDefault:"localhost:9000"`
	MinioAccessKeyID     string `env:"MINIO_ACCESS_KEY_ID" envDefault:"minioadmin"`
	MinioSecretAccessKey string `env:"MINIO_SECRET_ACCESS_KEY" envDefault:"minioadmin"`
	MinioUseSSL          bool   `env:"MINIO_USE_SSL" envDefault:"false"`
	STTServiceURL     string        `env:"STT_SERVICE_URL" envDefault:"http://localhost:8001"`
	STTGRPCAddr       string        `env:"STT_GRPC_ADDR" envDefault:"localhost:50051"`
	STTRequestTimeout time.Duration `env:"STT_REQUEST_TIMEOUT" envDefault:"120s"`
	AudioWorkerQueue     string `env:"AUDIO_WORKER_QUEUE" envDefault:"audio:jobs"`
	AudioWorkerCount     int    `env:"AUDIO_WORKER_COUNT" envDefault:"2"`
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
