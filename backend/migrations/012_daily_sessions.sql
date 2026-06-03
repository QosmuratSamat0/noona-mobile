-- +goose Up
-- +goose StatementBegin
CREATE TABLE daily_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT NOT NULL DEFAULT 0,
    total_results INT NOT NULL DEFAULT 0,
    total_words INT NOT NULL DEFAULT 0,
    unique_words INT NOT NULL DEFAULT 0,
    new_words_count INT NOT NULL DEFAULT 0,
    mistakes_count INT NOT NULL DEFAULT 0,
    grammar_errors INT NOT NULL DEFAULT 0,
    vocabulary_errors INT NOT NULL DEFAULT 0,
    pronunciation_errors INT NOT NULL DEFAULT 0,
    avg_score INT NOT NULL DEFAULT 0,
    cefr_level TEXT,
    main_weak_point TEXT,
    summary TEXT,
    next_step TEXT
);

CREATE INDEX idx_daily_sessions_user_date ON daily_sessions(user_id, date DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE daily_sessions;
-- +goose StatementEnd
