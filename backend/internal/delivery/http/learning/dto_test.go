package http

import (
	"testing"
	"time"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
)

func TestToResultListResponseUsesPublicJSONShape(t *testing.T) {
	createdAt := time.Now()
	items := toResultListResponse([]learning.Result{{
		ID:             "result-1",
		DailySessionID: "session-1",
		OriginalText:   "I go yesterday.",
		CorrectedText:  "I went yesterday.",
		Score:          88,
		CEFRLevel:      "A2",
		CreatedAt:      createdAt,
	}})

	if len(items) != 1 {
		t.Fatalf("expected one item, got %d", len(items))
	}
	if items[0].ResultID != "result-1" {
		t.Fatalf("expected result id result-1, got %q", items[0].ResultID)
	}
	if items[0].SessionID != "session-1" {
		t.Fatalf("expected session id session-1, got %q", items[0].SessionID)
	}
	if items[0].CreatedAt != createdAt {
		t.Fatalf("expected created_at to be preserved")
	}
}
