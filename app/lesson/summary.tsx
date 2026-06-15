import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, radius } from "@/constants/theme";
import { api } from "@/utils/api";

type ResultResponse = {
  result_id: string;
  original_text: string;
  corrected_text: string;
  score: number;
  cefr_level: string;
  mistakes: Array<{ title: string; explanation: string }>;
  next_steps?: string[];
};

type AnalysisSummary = {
  focus?: string;
  reason?: string;
  next_steps?: string[];
  next_recommendation?: string;
  daily?: {
    total_results: number;
    total_words: number;
    mistakes_count: number;
    avg_score: number;
    main_weak_point: string;
    summary: string;
    next_step: string;
  };
};

const asString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

export default function LessonSummaryScreen() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);

  const resultID = asString(params.result_id);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analysisResult, resultResponse] = await Promise.allSettled([
          api.get("/analysis/me"),
          resultID ? api.get(`/results/${resultID}`) : Promise.resolve(null),
        ]);

        if (analysisResult.status === "fulfilled") {
          setAnalysis(analysisResult.value.data || null);
        } else {
          console.error("Failed to load analysis summary", analysisResult.reason);
        }

        if (resultResponse.status === "fulfilled" && resultResponse.value?.data) {
          setResult(resultResponse.value.data);
        } else if (resultResponse.status === "rejected") {
          console.error("Failed to load lesson result", resultResponse.reason);
        }
      } catch (error) {
        console.error("Failed to load lesson summary", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [resultID]);

  const score = result?.score || analysis?.daily?.avg_score || 0;
  const focus = result?.mistakes?.[0]?.title || analysis?.focus || analysis?.daily?.main_weak_point || "Quick fix";
  const words = analysis?.daily?.total_words || 0;
  const exercises = analysis?.daily?.total_results || (result ? 1 : 0);
  const mistakes = analysis?.daily?.mistakes_count ?? result?.mistakes?.length ?? 0;

  const message = useMemo(() => {
    return analysis?.daily?.summary || analysis?.reason || result?.next_steps?.[0] || "Your quick fix has been saved.";
  }, [analysis, result]);

  if (loading) {
    return (
      <Screen>
        <Card style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption">Loading lesson summary...</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.trophy}>
          <Ionicons name="trophy" size={28} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>
          Quick Fix Complete
        </Text>
        <Text style={styles.heroText}>
          Noona saved this practice to your Progress and updated your weak points.
        </Text>
      </LinearGradient>

      <Card style={styles.summaryCard}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBadge}>
            <Text style={styles.score}>{score}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="eyebrow" style={{ color: colors.primary }}>Main focus</Text>
            <Text style={styles.focus} numberOfLines={1}>{focus}</Text>
            <Text variant="caption" numberOfLines={2}>{message}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <SummaryMetric value={String(exercises)} label="Exercises" icon="checkbox-outline" color={colors.primary} />
          <SummaryMetric value={String(words)} label="Words" icon="chatbox-outline" color={colors.green} />
          <SummaryMetric value={String(mistakes)} label="Fixes" icon="construct-outline" color={colors.orange} />
        </View>
      </Card>

      <Card style={styles.feedbackCard}>
        <Text variant="eyebrow" style={{ color: colors.green }}>Saved feedback</Text>
        <Text variant="subtitle" style={{ marginTop: 4 }}>{focus}</Text>
        <Text variant="caption" style={{ marginTop: 4 }}>{message}</Text>
      </Card>

      {analysis?.next_recommendation ? (
        <Card>
          <Text variant="eyebrow" style={{ color: colors.primary }}>Next recommendation</Text>
          <Text variant="caption" style={{ marginTop: 6 }}>{analysis.next_recommendation}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button variant="outline" onPress={() => router.push("/progress")} style={{ flex: 1 }}>
          Progress
        </Button>
        <Button onPress={() => router.replace("/")} style={{ flex: 1 }}>
          Done
        </Button>
      </View>
    </Screen>
  );
}

function SummaryMetric({
  value,
  label,
  icon,
  color,
}: {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    gap: 10,
  },
  hero: {
    borderRadius: radius.xl,
    padding: 22,
    alignItems: "center",
  },
  trophy: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "center",
  },
  heroText: {
    marginTop: 5,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  summaryCard: {
    gap: 16,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  score: {
    color: colors.primary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  scoreLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  focus: {
    marginTop: 4,
    marginBottom: 4,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    backgroundColor: "#fafafe",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  metricIcon: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: colors.greenLight,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
