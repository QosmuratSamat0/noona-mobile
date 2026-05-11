package activity

import "time"

type DailyStat struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Date         time.Time `json:"date"`
	SessionCount int       `json:"session_count"`
}

type Streak struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	CurrentStreak    int        `json:"current_streak"`
	LongestStreak    int        `json:"longest_streak"`
	LastActivityDate *time.Time `json:"last_activity_date"`
}
