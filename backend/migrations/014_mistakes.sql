-- +goose Up
-- +goose StatementBegin
CREATE TABLE mistakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result_id UUID REFERENCES results(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    title TEXT NOT NULL,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    explanation TEXT,
    original TEXT NOT NULL,
    corrected TEXT NOT NULL,
    offset_pos INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX idx_mistakes_result ON mistakes(result_id);
CREATE INDEX idx_mistakes_memory_key ON mistakes(user_id, pattern_key);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE mistakes;
-- +goose StatementEnd
