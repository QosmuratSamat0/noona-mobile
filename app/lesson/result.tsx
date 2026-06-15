import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { api } from "@/utils/api";

type ResultResponse = {
  result_id: string;
  original_text: string;
  corrected_text: string;
  score: number;
  cefr_level: string;
  mistakes: Array<{
    type: string;
    title: string;
    original_text: string;
    corrected_text: string;
    explanation: string;
    memory_message?: string;
  }>;
  speaking_quality?: {
    fluency_score?: number;
    answer_length?: string;
    message?: string;
  };
  next_steps?: string[];
};

const asString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

const parseResult = (value: string) => {
  if (!value) return null;
  try {
    return JSON.parse(value) as ResultResponse;
  } catch {
    return null;
  }
};

const parseIndex = (value: string) => {
  const next = Number.parseInt(value, 10);
  return Number.isFinite(next) && next >= 0 ? next : 0;
};

const sameSpokenText = (a: string, b: string) =>
  a
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim() ===
  b
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function LessonResultScreen() {
  const params = useLocalSearchParams();
  const [result, setResult] = useState<ResultResponse | null>(parseResult(asString(params.result)));
  const [loading, setLoading] = useState(false);
  const resultID = asString(params.result_id) || result?.result_id || "";
  const mistakeIndex = parseIndex(asString(params.mistake_index));

  useEffect(() => {
    if (result || !resultID) return;

    const loadResult = async () => {
      setLoading(true);
      try {
        let cached: ResultResponse | null = null;
        if (Platform.OS === "web") {
          cached = parseResult(localStorage.getItem(`lesson-result:${resultID}`) || "");
        }
        if (cached) {
          setResult(cached);
          return;
        }
        const response = await api.get(`/results/${resultID}`);
        setResult(response.data);
      } catch (error) {
        console.error("Failed to load lesson result", error);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [result, resultID]);

  const mistakes = result?.mistakes || [];
  const boundedMistakeIndex = mistakes.length ? Math.min(mistakeIndex, mistakes.length - 1) : 0;
  const mainMistake = mistakes[boundedMistakeIndex];
  const hasMistakes = mistakes.length > 0;
  const hasNextMistake = hasMistakes && boundedMistakeIndex < mistakes.length - 1;
  const focus = hasMistakes ? mainMistake?.title || "Quick fix" : "Looks good";
  const nextStep = hasMistakes
    ? mainMistake?.memory_message || result?.next_steps?.[0] || "Practice one more full sentence with this correction."
    : result?.next_steps?.[0] || "Great answer. Keep going with one more natural sentence.";
  const progressLabel = hasMistakes ? `${boundedMistakeIndex + 1} of ${mistakes.length}` : "Excellent";
  const shownOriginal = result?.original_text || mainMistake?.original_text || "";
  const shownCorrected = result?.corrected_text || mainMistake?.corrected_text || result?.original_text || "";
  const hasMeaningfulCorrection = hasMistakes && shownCorrected && !sameSpokenText(shownOriginal, shownCorrected);

  const scoreColor = useMemo(() => {
    if (!result) return "#fff";
    if (result.score >= 80) return "#fff";
    if (result.score >= 60) return colors.yellow;
    return colors.redLight;
  }, [result]);

  const openNext = () => {
    if (!result) return;

    if (hasNextMistake) {
      const nextIndex = boundedMistakeIndex + 1;
      const nextMistake = mistakes[nextIndex];
      router.push({
        pathname: "/lesson/practice",
        params: {
          original: nextMistake.original_text || result.original_text,
          corrected: nextMistake.corrected_text || result.corrected_text || result.original_text,
          sentence: result.original_text,
          better_sentence: result.corrected_text || result.original_text,
          reason: nextMistake.explanation || nextMistake.memory_message || "Practice this correction once.",
          pattern: nextMistake.title || "Quick fix",
          mistake_index: String(nextIndex),
        },
      });
      return;
    }

    router.push({ pathname: "/lesson/summary", params: { result_id: result.result_id } });
  };

  if (loading || !result) {
    return (
      <Screen>
        <Card style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption">{loading ? "Loading feedback..." : "No result yet."}</Text>
          {!loading && (
            <Button variant="outline" onPress={() => router.replace("/lesson/practice")}>
              Back to quick fix
            </Button>
          )}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/")} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Feedback</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
          <View style={styles.heroLine}>
            <Ionicons name="sparkles" size={15} color="#fff" />
            <Text style={styles.heroSmall}>Checked by Noona</Text>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{progressLabel}</Text>
            </View>
          </View>
          <View style={styles.scoreRow}>
            <View>
              <Text style={styles.scoreLabel}>Your score</Text>
              <Text style={[styles.score, { color: scoreColor }]}>{result.score || 0}</Text>
            </View>
            <View style={{ alignItems: "flex-end", flex: 1 }}>
              <Text style={styles.scoreLabel}>Main focus</Text>
              <Text style={styles.focus} numberOfLines={1}>{focus}</Text>
            </View>
          </View>
        </LinearGradient>

        {hasMistakes ? (
          <Card style={styles.comparisonCard}>
            <View style={styles.comparisonBlock}>
              <Text variant="eyebrow">Your full answer</Text>
              <Text style={styles.answerText}>{shownOriginal}</Text>
            </View>
            {hasMeaningfulCorrection && (
              <>
                <View style={styles.divider} />
                <View style={styles.comparisonBlock}>
                  <Text variant="eyebrow" style={{ color: colors.primary }}>Better full sentence</Text>
                  <Text style={styles.betterAnswer}>{shownCorrected}</Text>
                </View>
              </>
            )}
          </Card>
        ) : (
          <Card style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subtitle">Excellent</Text>
              <Text variant="caption" style={{ marginTop: 4 }}>No spoken English issue detected.</Text>
            </View>
          </Card>
        )}

        <Card>
          <Text variant="subtitle">{hasMistakes ? "Why" : "You said"}</Text>
          <Text variant="caption" style={{ marginTop: 6 }}>
            {hasMistakes
              ? mainMistake?.explanation || result.speaking_quality?.message || "Practice this correction in a full sentence."
              : shownOriginal}
          </Text>
        </Card>

        <Card>
          <Text variant="subtitle">Next step</Text>
          <Text variant="caption" style={{ marginTop: 6 }}>{nextStep}</Text>
        </Card>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          variant="outline"
          onPress={() =>
            router.push({
              pathname: "/lesson/practice",
              params: {
                original: hasMistakes ? mainMistake?.original_text || shownOriginal : shownOriginal,
                corrected: hasMistakes ? mainMistake?.corrected_text || shownCorrected : shownOriginal,
                sentence: shownOriginal,
                better_sentence: hasMistakes ? shownCorrected : shownOriginal,
                reason: mainMistake?.explanation || nextStep,
                pattern: focus,
                mistake_index: String(boundedMistakeIndex),
              },
            })
          }
          style={{ flex: 1 }}
        >
          {hasMistakes ? "Practice again" : "Try again"}
        </Button>
        <Button onPress={openNext} style={{ flex: 1 }}>
          {hasNextMistake ? "Next mistake" : "Summary"}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerCard: {
    alignItems: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    gap: 16,
    paddingBottom: 4,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  hero: {
    borderRadius: 28,
    padding: 20,
  },
  heroLine: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  heroSmall: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  heroPill: {
    marginLeft: "auto",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  scoreRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  score: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
  },
  focus: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "right",
  },
  comparisonCard: {
    gap: 14,
  },
  comparisonBlock: {
    gap: 7,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: colors.greenLight,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  answerText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  wrongAnswer: {
    color: colors.red,
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: "line-through",
  },
  betterAnswer: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
