-- +goose Up
-- +goose StatementBegin
ALTER TABLE profiles ADD COLUMN native_language TEXT NOT NULL DEFAULT 'ru';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE profiles DROP COLUMN native_language;
-- +goose StatementEnd
