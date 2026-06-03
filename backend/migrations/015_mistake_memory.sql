-- +goose Up
-- +goose StatementBegin
CREATE TABLE mistake_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_key TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    total_count INT NOT NULL DEFAULT 0,
    recent_count INT NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'active',
    last_original_text TEXT,
    last_corrected_text TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, pattern_key)
);

CREATE INDEX idx_mistake_memory_user_status ON mistake_memory(user_id, status, last_seen_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE mistake_memory;
-- +goose StatementEnd
