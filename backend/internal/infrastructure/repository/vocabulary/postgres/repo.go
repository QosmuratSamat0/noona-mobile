package postgres

import (
	"context"
	"errors"
	"sort"

	"github.com/QosmuratSamat0/Noona-AI/backend/internal/domain/learning"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

func (r *Repo) TrackWords(ctx context.Context, userID, resultID, transcriptID string, words []learning.WordUsage) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	seenNew := make(map[string]bool)
	for _, word := range words {
		if word.Normalized == "" {
			continue
		}
		var existingID string
		err := tx.QueryRow(ctx, `SELECT id FROM user_words WHERE user_id = $1 AND normalized_word = $2`, userID, word.Normalized).Scan(&existingID)
		isNew := false
		if errors.Is(err, pgx.ErrNoRows) {
			isNew = !seenNew[word.Normalized]
			seenNew[word.Normalized] = true
			if err := tx.QueryRow(ctx, `
				INSERT INTO user_words (user_id, word, normalized_word, usage_count)
				VALUES ($1, $2, $3, 1)
				RETURNING id
			`, userID, word.Word, word.Normalized).Scan(&existingID); err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else {
			if _, err := tx.Exec(ctx, `
				UPDATE user_words
				SET usage_count = usage_count + 1, last_used_at = now(), word = $3
				WHERE user_id = $1 AND normalized_word = $2
			`, userID, word.Normalized, word.Word); err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO word_usage_events (user_id, result_id, transcript_id, word, normalized_word, is_new)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, userID, resultID, transcriptID, word.Word, word.Normalized, isNew)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repo) GetResultStats(ctx context.Context, userID, resultID string) (learning.VocabularyStats, error) {
	return r.wordStats(ctx, `user_id = $1 AND result_id = $2`, userID, resultID)
}

func (r *Repo) GetTodayStats(ctx context.Context, userID string) (learning.VocabularyStats, error) {
	return r.wordStats(ctx, `user_id = $1 AND created_at::date = CURRENT_DATE`, userID)
}

func (r *Repo) wordStats(ctx context.Context, where string, args ...any) (learning.VocabularyStats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT word, normalized_word, is_new
		FROM word_usage_events
		WHERE `+where, args...)
	if err != nil {
		return learning.VocabularyStats{}, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	display := make(map[string]string)
	newWords := make(map[string]struct{})
	total := 0
	for rows.Next() {
		var word, normalized string
		var isNew bool
		if err := rows.Scan(&word, &normalized, &isNew); err != nil {
			return learning.VocabularyStats{}, err
		}
		total++
		counts[normalized]++
		if display[normalized] == "" {
			display[normalized] = word
		}
		if isNew {
			newWords[normalized] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return learning.VocabularyStats{}, err
	}

	stats := learning.VocabularyStats{TotalWords: total, UniqueWords: len(counts)}
	for word := range newWords {
		stats.NewWords = append(stats.NewWords, display[word])
	}
	for word, count := range counts {
		if count > 1 {
			stats.RepeatedWords = append(stats.RepeatedWords, display[word])
		}
	}
	sort.Strings(stats.NewWords)
	sort.Strings(stats.RepeatedWords)
	stats.OverusedWords = overused(counts)
	return stats, nil
}

func overused(counts map[string]int) []learning.WordSuggestion {
	alts := map[string][]string{
		"good": {"useful", "strong", "excellent"},
		"very": {"really", "extremely", "especially"},
		"nice": {"pleasant", "kind", "enjoyable"},
	}
	items := make([]learning.WordSuggestion, 0)
	for word, suggestions := range alts {
		if counts[word] >= 2 {
			items = append(items, learning.WordSuggestion{Word: word, Alternatives: suggestions})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Word < items[j].Word })
	return items
}
