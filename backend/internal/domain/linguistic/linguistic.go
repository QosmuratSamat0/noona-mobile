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
	CEFRLevel     string `json:"cefr_level"`
}

type MistakeModel struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Original  string    `json:"original"`
	Corrected string    `json:"corrected"`
	OffsetPos int       `json:"offset_pos"`
	CreatedAt time.Time `json:"created_at"`
}


type AIMistake struct {
	Original  string `json:"original"`
	Corrected string `json:"corrected"`
	Type      string `json:"type"`      // Тип: grammar, vocabulary, pronunciation
	Offset    int    `json:"offset"`    // Позиция в тексте (для подсветки в UI)
}

type AIAnalysis struct {
	Correction  string      `json:"correction"`  
	Explanation string      `json:"explanation"`
	CEFRLevel   string      `json:"cefr_level"`
	Mistakes    []AIMistake `json:"mistakes"`    
	Suggested   []string    `json:"suggested"`
}

type ResponseChunk struct {
	Text    string `json:"text"`     
	IsFinal bool   `json:"is_final"` 
}
