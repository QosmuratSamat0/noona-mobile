package linguistic

type AIMistake struct {
	Original    string `json:"original"`
	Corrected   string `json:"corrected"`
	Type        string `json:"type"`
	PatternKey  string `json:"pattern_key"`
	Title       string `json:"title"`
	Explanation string `json:"explanation"`
	Offset      int    `json:"offset"`
}

type AIAnalysis struct {
	Correction  string      `json:"correction"`
	Explanation string      `json:"explanation"`
	CEFRLevel   string      `json:"cefr_level"`
	Mistakes    []AIMistake `json:"mistakes"`
	Suggested   []string    `json:"suggested"`
}

type QuickFeedback struct {
	CorrectedText string `json:"corrected_text"`
	Reason        string `json:"reason"`
	Original      string `json:"original,omitempty"`
}

type ResponseChunk struct {
	Text    string `json:"text"`
	IsFinal bool   `json:"is_final"`
}
