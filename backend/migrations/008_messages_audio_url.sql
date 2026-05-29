-- +goose Up
-- +goose StatementBegin
ALTER TABLE messages ADD COLUMN audio_url TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE messages DROP COLUMN audio_url;
-- +goose StatementEnd
