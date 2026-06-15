import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { colors, radius, shadow } from "@/constants/theme";
import { api, isUnauthorizedError, removeToken } from "@/utils/api";

type AnalysisSummary = {
  focus?: string;
  reason?: string;
  next_steps?: string[];
  next_recommendation?: string;
  top_mistakes?: Array<{
    title: string;
    message?: string;
    total_count?: number;
    recent_count?: number;
  }>;
  vocabulary?: {
    total_words?: number;
  };
  skill_progress?: {
    total_results?: number;
    average_score?: number;
  };
  activity?: {
    current_streak?: number;
    longest_streak?: number;
    sessions_count?: number;
    active_days?: number;
  };
  daily?: {
    total_results?: number;
    total_words?: number;
    mistakes_count?: number;
    avg_score?: number;
    main_weak_point?: string;
    summary?: string;
    next_step?: string;
  };
};

type UserProfile = {
  name?: string;
};

const todayLabel = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
}).format(new Date());

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function HomeScreen() {
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadHome = async () => {
      setLoading(true);
      try {
        const [analysisResult, userResult] = await Promise.allSettled([
          api.get("/analysis/me"),
          api.get("/users/me"),
        ]);

        if (cancelled) return;

        if (analysisResult.status === "fulfilled") {
          setAnalysis(analysisResult.value.data || null);
        } else {
          if (isUnauthorizedError(analysisResult.reason)) {
            await removeToken();
            router.replace("/login");
            return;
          }
          console.error("Failed to load home analysis", analysisResult.reason);
        }

        if (userResult.status === "fulfilled") {
          setUser(userResult.value.data || null);
        } else {
          if (isUnauthorizedError(userResult.reason)) {
            await removeToken();
            router.replace("/login");
            return;
          }
          console.error("Failed to load home user", userResult.reason);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHome();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = analysis?.daily;
  const streak = analysis?.activity?.current_streak ?? 0;
  const focus = today?.main_weak_point || analysis?.focus || "";
  const summary = today?.summary || analysis?.reason || "";
  const score = today?.avg_score ?? 0;
  const sessions = today?.total_results ?? 0;
  const words = today?.total_words ?? 0;
  const fixes = today?.mistakes_count ?? 0;
  const topMistake = analysis?.top_mistakes?.[0];
  const hasPracticeToday = sessions > 0 || words > 0 || fixes > 0;

  const nextAction = useMemo(() => {
    if (topMistake?.title) {
      return {
        label: "Next best action",
        title: `Practice ${topMistake.title}`,
        body: analysis?.next_recommendation || topMistake.message || "Do one short answer using this pattern.",
        time: "3 min",
        button: "Start practice",
        route: "/lesson/practice" as const,
      };
    }

    if (!hasPracticeToday) {
      return {
        label: "Today",
        title: "Start today's practice",
        body: analysis?.next_recommendation || "Record one answer so Noona can build your real daily summary.",
        time: "2 min",
        button: "Choose mode",
        route: "/lessons" as const,
      };
    }

    return {
      label: "Next best action",
      title: focus || "Build a longer answer",
      body: analysis?.next_recommendation || today?.next_step || "Record one longer answer and compare your score.",
      time: "3 min",
      button: "Continue",
      route: "/lessons" as const,
    };
  }, [analysis, focus, hasPracticeToday, today?.next_step, topMistake]);

  const openNextAction = () => {
    if (nextAction.route === "/lesson/practice" && topMistake?.title) {
      router.push({
        pathname: "/lesson/practice",
        params: {
          pattern: topMistake.title,
          reason: topMistake.message || analysis?.next_recommendation || "",
        },
      });
      return;
    }
    router.push(nextAction.route);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption">Loading today...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="caption">{greeting()}</Text>
          <Text variant="title">{user?.name || "Noona learner"}</Text>
        </View>
        <Pressable onPress={() => router.push("/progress")} style={styles.streak}>
          <Ionicons name="flame" size={16} color={colors.orange} />
          <Text style={styles.streakText}>{streak}</Text>
        </Pressable>
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>{nextAction.label}</Text>
          </View>
          <Text style={styles.heroTime}>{nextAction.time}</Text>
        </View>
        <Text style={styles.heroTitle}>{nextAction.title}</Text>
        <Text style={styles.heroSub}>{nextAction.body}</Text>
        <Button
          variant="secondary"
          onPress={openNextAction}
          style={styles.heroButton}
        >
          {nextAction.button}
        </Button>
      </LinearGradient>

      <View style={styles.metrics}>
        <MetricTile value={String(sessions)} label="Answers" icon="radio-outline" color={colors.primary} />
        <MetricTile value={String(words)} label="Words" icon="chatbox-outline" color={colors.green} />
        <MetricTile value={String(fixes)} label="Fixes" icon="construct-outline" color={colors.orange} />
      </View>

      <Card style={styles.universalSummary}>
        <View style={styles.summaryTop}>
          <View>
            <Text variant="eyebrow" style={{ color: colors.primary }}>Today snapshot</Text>
            <Text variant="subtitle" style={styles.summaryTitle}>Today, {todayLabel}</Text>
          </View>
          <Pressable onPress={() => router.push("/progress")} style={styles.roundLink}>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.summaryBody}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.focusLabel}>Main focus</Text>
            <Text style={styles.focusValue} numberOfLines={1}>
              {focus || (hasPracticeToday ? "Keep speaking daily" : "No practice yet today")}
            </Text>
            <Text variant="caption" numberOfLines={2}>
              {summary || "Your real daily summary will appear after your first practice today."}
            </Text>
          </View>
        </View>

        <View style={styles.summaryProgress}>
          <View style={[styles.summaryProgressFill, { width: `${Math.max(0, Math.min(score, 100))}%` }]} />
        </View>

        <View style={styles.summaryChips}>
          <View style={styles.summaryChip}>
            <Ionicons name="calendar-clear-outline" size={14} color={colors.primary} />
            <Text style={styles.summaryChipText}>{sessions} answers today</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: colors.orangeLight }]}>
            <Ionicons name="flash-outline" size={14} color={colors.orange} />
            <Text style={[styles.summaryChipText, { color: "#9a3412" }]}>{fixes} fixes today</Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

function MetricTile({
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
    <View style={styles.metricTile}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={15} color={color} />
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow,
  },
  streakText: {
    fontWeight: "900",
  },
  hero: {
    borderRadius: radius.xl,
    padding: 20,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroTime: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  heroTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  heroSub: {
    marginTop: 5,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  heroButton: {
    marginTop: 16,
    backgroundColor: "#fff",
  },
  metrics: {
    flexDirection: "row",
    gap: 10,
  },
  metricTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  universalSummary: {
    gap: 15,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryTitle: {
    marginTop: 3,
  },
  roundLink: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  summaryBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 7,
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  focusLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  focusValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  summaryProgress: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#f0eef8",
    overflow: "hidden",
  },
  summaryProgressFill: {
    width: "68%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.green,
  },
  summaryChips: {
    flexDirection: "row",
    gap: 8,
  },
  summaryChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
  },
  summaryChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
});
