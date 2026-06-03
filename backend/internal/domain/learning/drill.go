package learning

import "time"

type Drill struct {
	ID              string
	UserID          string
	MistakeMemoryID string
	PatternKey      string
	Title           string
	Instruction     string
	Status          string
	DueDate         *time.Time
	CompletedAt     *time.Time
	CreatedAt       time.Time
}
