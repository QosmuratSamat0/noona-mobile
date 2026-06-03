package learning

import "time"

type Transcript struct {
	ID           string
	UserID       string
	OriginalText string
	AudioURL     string
	CreatedAt    time.Time
}
