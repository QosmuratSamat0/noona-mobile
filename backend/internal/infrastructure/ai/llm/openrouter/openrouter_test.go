package openrouter

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCompleteMapsNonJSONHTTPErrorBeforeParsingSuccessShape(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	}))
	defer server.Close()

	provider, err := NewProvider("key", server.URL, "model", "", "")
	if err != nil {
		t.Fatalf("NewProvider returned error: %v", err)
	}

	_, err = provider.complete(context.Background(), []message{{Role: "user", Content: "hello"}}, false)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "retryable error (quota)") {
		t.Fatalf("expected retryable quota error, got %v", err)
	}
}

func TestCompleteUsesJSONErrorMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"error":{"message":"provider overloaded"}}`))
	}))
	defer server.Close()

	provider, err := NewProvider("key", server.URL, "model", "", "")
	if err != nil {
		t.Fatalf("NewProvider returned error: %v", err)
	}

	_, err = provider.complete(context.Background(), []message{{Role: "user", Content: "hello"}}, false)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "provider overloaded") {
		t.Fatalf("expected provider error message, got %v", err)
	}
}
