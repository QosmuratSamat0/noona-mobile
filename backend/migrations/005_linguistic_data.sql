-- +goose Up
-- +goose StatementBegin
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL
);

CREATE TABLE corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    corrected_text TEXT NOT NULL,
    explanation TEXT,
    cefr_level TEXT -- A1, A2, B1, B2, C1, C2
);

CREATE TABLE mistakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- grammar, vocabulary, pronunciation
    original TEXT NOT NULL,
    corrected TEXT NOT NULL,
    offset_pos INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transcripts_message_id ON transcripts(message_id);
CREATE INDEX idx_corrections_transcript_id ON corrections(transcript_id);
CREATE INDEX idx_mistakes_user_id ON mistakes(user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE mistakes;
DROP TABLE corrections;
DROP TABLE transcripts;
-- +goose StatementEnd
