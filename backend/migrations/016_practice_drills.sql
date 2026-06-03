-- +goose Up
-- +goose StatementBegin
CREATE TABLE practice_drills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mistake_memory_id UUID REFERENCES mistake_memory(id) ON DELETE SET NULL,
    pattern_key TEXT NOT NULL,
    title TEXT NOT NULL,
    instruction TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_practice_drills_user_status ON practice_drills(user_id, status, due_date);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE practice_drills;
-- +goose StatementEnd
