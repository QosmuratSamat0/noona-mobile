-- +goose Up
-- +goose StatementBegin
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    daily_session_id UUID REFERENCES daily_sessions(id) ON DELETE SET NULL,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    cefr_level TEXT,
    fluency_score INT NOT NULL DEFAULT 0,
    grammar_score INT NOT NULL DEFAULT 0,
    vocabulary_score INT NOT NULL DEFAULT 0,
    pronunciation_score INT NOT NULL DEFAULT 0,
    summary TEXT,
    next_step TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_results_user_created_at ON results(user_id, created_at DESC);
CREATE INDEX idx_results_session ON results(daily_session_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE results;
-- +goose StatementEnd
