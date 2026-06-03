-- +goose Up
-- +goose StatementBegin
CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_count INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, date)
);

CREATE TABLE streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_active_date DATE
);

CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE streaks;
DROP TABLE daily_stats;
-- +goose StatementEnd
