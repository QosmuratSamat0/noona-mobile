package linguistic

import "time"

type Transcript struct {
	ID        string `json:"id"`
	MessageID string `json:"message_id"`
	RawText   string `json:"raw_text"`
}

type Correction struct {
	ID            string `json:"id"`
	TranscriptID  string `json:"transcript_id"`
	CorrectedText string `json:"corrected_text"`
	Explanation   string `json:"explanation"`
}

type Mistake struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Original  string    `json:"original"`
	Fixed     string    `json:"fixed"`
	CreatedAt time.Time `json:"created_at"`
}
