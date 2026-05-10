package config

import (
	"time"

	"github.com/caarlos0/env/v9"
)

type Config struct {
	Env         string `env:"ENV" envDefault:"local"`
	DatabaseURL string `env:"DATABASE_URL"`
	JWTSecret   string `env:"JWT_SECRET"`
	HTTPServer  HTTPServer
}

type HTTPServer struct {
	Address     string        `env:"ADDRESS" envDefault:"0.0.0.0:8080"`
	Timeout     time.Duration `env:"TIMEOUT" envDefault:"15"`
	IdleTimeout time.Duration `env:"IDLE_TIMEOUT" envDefault:"60"`
}

func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
