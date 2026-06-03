-- +goose Up
-- +goose StatementBegin
CREATE TABLE user_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    usage_count INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, normalized_word)
);

CREATE TABLE word_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result_id UUID REFERENCES results(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    is_new BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_words_user_word ON user_words(user_id, normalized_word);
CREATE INDEX idx_word_usage_events_user_created ON word_usage_events(user_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE word_usage_events;
DROP TABLE user_words;
-- +goose StatementEnd
