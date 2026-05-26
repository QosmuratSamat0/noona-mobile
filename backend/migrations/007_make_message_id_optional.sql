-- +goose Up
-- +goose StatementBegin
ALTER TABLE transcripts ALTER COLUMN message_id DROP NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE transcripts ALTER COLUMN message_id SET NOT NULL;
-- +goose StatementEnd
