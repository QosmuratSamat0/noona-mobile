package vocabulary

import "testing"

func TestAnalyzeTextCountsWordsAndRepeatedWords(t *testing.T) {
	stats, words := AnalyzeText("Good, good students are very very nice.")
	if stats.TotalWords != 7 {
		t.Fatalf("total words = %d", stats.TotalWords)
	}
	if stats.UniqueWords != 5 {
		t.Fatalf("unique words = %d", stats.UniqueWords)
	}
	if len(words) != 7 {
		t.Fatalf("tracked words = %d", len(words))
	}
	if len(stats.RepeatedWords) != 2 {
		t.Fatalf("repeated words = %+v", stats.RepeatedWords)
	}
	if len(stats.OverusedWords) != 2 {
		t.Fatalf("overused words = %+v", stats.OverusedWords)
	}
}
