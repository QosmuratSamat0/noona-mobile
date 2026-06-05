package practice

import "io"

type TextInput struct {
	UserID         string
	Text           string
	DailySessionID string
}

type AudioInput struct {
	UserID         string
	File           io.Reader
	FileSize       int64
	ContentType    string
	Ext            string
	DailySessionID string
}
