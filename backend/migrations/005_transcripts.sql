-- +goose Up
-- +goose StatementBegin
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    original_text TEXT NOT NULL,
    audio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcripts_message_id ON transcripts(message_id);
CREATE INDEX idx_transcripts_user_created_at ON transcripts(user_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE transcripts;
-- +goose StatementEnd
