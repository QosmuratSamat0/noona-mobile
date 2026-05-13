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

// AI Analysis Models

// AIMistake описывает конкретную ошибку в речи пользователя
type AIMistake struct {
	Original  string `json:"original"`  // Как сказал пользователь
	Corrected string `json:"corrected"` // Как правильно
	Type      string `json:"type"`      // Тип: grammar, vocabulary, pronunciation
	Offset    int    `json:"offset"`    // Позиция в тексте (для подсветки в UI)
}

// AIAnalysis — итоговый результат глубокого разбора фразы
type AIAnalysis struct {
	Correction  string      `json:"correction"`  // Полный исправленный текст
	Explanation string      `json:"explanation"` // Объяснение правил простыми словами
	CEFRLevel   string      `json:"cefr_level"`  // Оценка уровня (A1-C2)
	Mistakes    []AIMistake `json:"mistakes"`    // Список конкретных ошибок
	Suggested   []string    `json:"suggested"`   // Варианты, что ответить пользователю дальше
}

// ResponseChunk — единица данных для UI-стриминга
type ResponseChunk struct {
	Text    string `json:"text"`     // Кусочек текста
	IsFinal bool   `json:"is_final"` // Флаг завершения мысли
}
