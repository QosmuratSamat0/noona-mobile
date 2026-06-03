-- +goose Up
-- +goose StatementBegin
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    sessions_count INT NOT NULL DEFAULT 0,
    total_words INT NOT NULL DEFAULT 0,
    new_words_count INT NOT NULL DEFAULT 0,
    mistakes_count INT NOT NULL DEFAULT 0,
    fixed_mistakes_count INT NOT NULL DEFAULT 0,
    avg_score INT NOT NULL DEFAULT 0,
    weak_point TEXT,
    summary_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_summaries_user_date ON daily_summaries(user_id, date DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE daily_summaries;
-- +goose StatementEnd
