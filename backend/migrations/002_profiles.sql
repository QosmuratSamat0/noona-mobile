-- +goose Up
-- +goose StatementBegin
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    cefr_level TEXT DEFAULT 'A1',
    streak_count INT DEFAULT 0
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE profiles;
-- +goose StatementEnd
