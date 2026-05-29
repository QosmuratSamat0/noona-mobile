package jsoncache

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

func Get[T any](ctx context.Context, client *redis.Client, key string) (T, bool) {
	var zero T
	if client == nil {
		return zero, false
	}
	raw, err := client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return zero, false
		}
		return zero, false
	}
	var value T
	if err := json.Unmarshal(raw, &value); err != nil {
		_ = client.Del(ctx, key).Err()
		return zero, false
	}
	return value, true
}

func Set(ctx context.Context, client *redis.Client, key string, value any, ttl time.Duration) {
	if client == nil {
		return
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return
	}
	_ = client.Set(ctx, key, raw, ttl).Err()
}

func Delete(ctx context.Context, client *redis.Client, keys ...string) {
	if client == nil || len(keys) == 0 {
		return
	}
	_ = client.Del(ctx, keys...).Err()
}
