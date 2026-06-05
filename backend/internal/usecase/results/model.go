package results

type CreateInput struct {
	UserID         string
	Text           string
	AudioURL       string
	DailySessionID string
}

type scores struct {
	overall       int
	fluency       int
	grammar       int
	vocabulary    int
	pronunciation int
}
