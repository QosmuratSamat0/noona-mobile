import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
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
    unique_words?: number;
    new_words?: string[];
    overused_words?: Array<{ word: string; alternatives: string[] }>;
  };
  skill_progress?: {
    total_results?: number;
    average_score?: number;
    current_cefr_level?: string;
  };
  activity?: {
    current_streak?: number;
    sessions_count?: number;
    active_days?: number;
  };
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

type ActivityResponse = {
  daily_stats?: Array<{
    date: string;
    session_count: number;
  }>;
};

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const currentDay = today.getDate();
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(today);
const shortMonthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(today);

export default function ProgressScreen() {
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [selectionMode, setSelectionMode] = useState<"day" | "week" | "month">("day");
  const [rangeStart, setRangeStart] = useState(currentDay);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnalysis = async () => {
      try {
        const [analysisResult, activityResult] = await Promise.allSettled([
          api.get("/analysis/me"),
          api.get("/activity/me"),
        ]);
        if (!cancelled) {
          if (analysisResult.status === "fulfilled") {
            setAnalysis(analysisResult.value.data || null);
          } else {
            if (isUnauthorizedError(analysisResult.reason)) {
              await removeToken();
              router.replace("/login");
              return;
            }
            console.error("Failed to load progress summary", analysisResult.reason);
          }
          if (activityResult.status === "fulfilled") {
            setActivity(activityResult.value.data || null);
          } else {
            if (isUnauthorizedError(activityResult.reason)) {
              await removeToken();
              router.replace("/login");
              return;
            }
            console.error("Failed to load activity summary", activityResult.reason);
          }
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await removeToken();
          router.replace("/login");
          return;
        }
        console.error("Failed to load progress summary", error);
      }
    };

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, []);

  const focus = analysis?.daily?.main_weak_point || analysis?.focus || "No weak point yet";
  const summary = analysis?.daily?.summary || analysis?.reason || "Your summary will appear after practice.";
  const score = analysis?.daily?.avg_score ?? 0;
  const sessions = analysis?.daily?.total_results ?? 0;
  const words = analysis?.daily?.total_words ?? 0;
  const fixes = analysis?.daily?.mistakes_count ?? 0;

  const activeDays = useMemo(() => {
    const days = new Set<number>();
    activity?.daily_stats?.forEach((stat) => {
      const date = new Date(stat.date);
      if (date.getFullYear() === currentYear && date.getMonth() === currentMonth && stat.session_count > 0) {
        days.add(date.getDate());
      }
    });
    return days;
  }, [activity]);

  const calendarDays = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return {
          day,
          done: activeDays.has(day),
          today: day === currentDay,
        };
      }),
    [activeDays],
  );

  const weakPoints = useMemo(() => {
    if (!analysis?.top_mistakes?.length) {
      return [];
    }
    return analysis.top_mistakes.slice(0, 3).map((mistake) => ({
      title: mistake.title,
      reason: mistake.message || "This pattern appeared in your practice.",
      count: mistake.recent_count || mistake.total_count || 1,
    }));
  }, [analysis]);

  const mainFix = weakPoints[0];
  const selectedEnd = rangeEnd ?? rangeStart;
  const isRange = selectedEnd !== rangeStart;
  const selectedLabel = isRange ? `${shortMonthLabel} ${rangeStart} - ${shortMonthLabel} ${selectedEnd}` : `${shortMonthLabel} ${rangeStart}`;
  const summaryTitleLabel =
    selectionMode === "month" ? "Monthly summary" : selectionMode === "week" ? "Weekly summary" : "Daily summary";

  const selectCalendarDay = (day: number) => {
    if (selectionMode === "month") {
      setRangeStart(1);
      setRangeEnd(daysInMonth);
      return;
    }

    if (selectionMode === "week") {
      const weekStart = day - ((day - 1) % 7);
      setRangeStart(weekStart);
      setRangeEnd(Math.min(weekStart + 6, daysInMonth));
      return;
    }

    if (rangeEnd !== null || day < rangeStart || day === rangeStart) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }

    setRangeEnd(day);
  };

  const openQuickFix = (mistake = mainFix) => {
    if (!mistake) {
      router.push("/lessons");
      return;
    }
    router.push({
      pathname: "/lesson/practice",
      params: {
        reason: mistake.reason,
        pattern: mistake.title,
      },
    });
  };

  return (
    <Screen>
      <Card style={styles.calendarCard}>
        <View style={styles.sectionRow}>
          <View>
            <Text variant="title">Progress</Text>
            <Text variant="caption">Choose a day or range.</Text>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={15} color={colors.orange} />
            <Text style={styles.streakText}>{analysis?.activity?.current_streak ?? 0}</Text>
          </View>
        </View>

        <View style={styles.calendarHeader}>
          <View>
            <Text variant="subtitle">{monthLabel}</Text>
            <Text variant="caption">Selected: {selectedLabel}</Text>
          </View>
          <Ionicons name="calendar-clear-outline" size={21} color={colors.primary} />
        </View>
        <View style={styles.rangeModes}>
          {[
            { key: "day", label: "Day" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
          ].map((mode) => {
            const active = selectionMode === mode.key;
            return (
              <Pressable
                key={mode.key}
                onPress={() => {
                  setSelectionMode(mode.key as "day" | "week" | "month");
                  if (mode.key === "day") {
                    setRangeEnd(null);
                  }
                  if (mode.key === "week") {
                    const weekStart = rangeStart - ((rangeStart - 1) % 7);
                    setRangeStart(weekStart);
                    setRangeEnd(Math.min(weekStart + 6, daysInMonth));
                  }
                  if (mode.key === "month") {
                    setRangeStart(1);
                    setRangeEnd(daysInMonth);
                  }
                }}
                style={[styles.rangeMode, active && styles.rangeModeActive]}
              >
                <Text style={[styles.rangeModeText, active && styles.rangeModeTextActive]}>
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.weekNames}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <Text key={`${day}-${index}`} variant="caption" style={styles.weekName}>{day}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {calendarDays.map((item) => {
            const inRange = item.day >= rangeStart && item.day <= selectedEnd;
            const isStart = item.day === rangeStart;
            const isEnd = item.day === selectedEnd && isRange;
            return (
              <Pressable
                key={item.day}
                onPress={() => selectCalendarDay(item.day)}
                style={[
                  styles.day,
                  item.done && styles.dayDone,
                  item.today && styles.dayToday,
                  inRange && styles.dayInRange,
                  isStart && styles.dayRangeStart,
                  isEnd && styles.dayRangeEnd,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    item.done && styles.dayTextDone,
                    item.today && styles.dayTextToday,
                    inRange && styles.dayTextInRange,
                    (isStart || isEnd) && styles.dayTextActive,
                  ]}
                >
                  {item.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text variant="eyebrow" style={{ color: colors.green }}>Universal summary</Text>
            <Text variant="subtitle" style={styles.summaryHeading}>{selectedLabel}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <SummaryMetric value={String(sessions)} label="Answers" icon="radio-outline" color={colors.primary} />
          <SummaryMetric value={String(words)} label="Words" icon="chatbox-outline" color={colors.green} />
          <SummaryMetric value={String(fixes)} label="Fixes" icon="construct-outline" color={colors.orange} />
        </View>

        <LinearGradient colors={["#0f766e", colors.green]} style={styles.summaryHero}>
          <View style={styles.summaryHeroTop}>
            <Text style={styles.summaryKicker}>{summaryTitleLabel}</Text>
            <Text style={styles.summaryDate}>{selectedLabel}</Text>
          </View>
          <Text style={styles.summaryTitle} numberOfLines={2}>{focus}</Text>
          <Text style={styles.summaryText} numberOfLines={2}>{summary}</Text>
        </LinearGradient>
      </Card>

      {mainFix ? (
        <Card style={styles.quickFixCard}>
          <View style={styles.quickFixHeader}>
            <View style={styles.quickFixIcon}>
              <Ionicons name="flash" size={18} color={colors.orange} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="eyebrow" style={{ color: colors.orange }}>Recommended quick fix</Text>
              <Text variant="subtitle" numberOfLines={1}>{mainFix.title}</Text>
              <Text variant="caption" numberOfLines={2}>{mainFix.reason}</Text>
            </View>
          </View>
          <Pressable onPress={() => openQuickFix()} style={styles.practiceButton}>
            <Text style={styles.practiceText}>Practice this</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionRow}>
          <Text variant="subtitle">Weak points</Text>
          <Text style={styles.sectionLink}>Memory</Text>
        </View>
        <View style={styles.weakList}>
          {weakPoints.length > 0 ? weakPoints.map((mistake) => (
            <Pressable key={mistake.title} onPress={() => openQuickFix(mistake)} style={styles.weakRow}>
              <View style={styles.weakCount}>
                <Text style={styles.weakCountText}>{mistake.count}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.weakTitle} numberOfLines={1}>{mistake.title}</Text>
                <Text variant="caption" numberOfLines={1}>{mistake.reason}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
          )) : (
            <View style={styles.emptyWeak}>
              <Text style={styles.weakTitle}>No weak points yet</Text>
              <Text variant="caption">Practice answers will build your memory automatically.</Text>
            </View>
          )}
        </View>
      </Card>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakPill: {
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
  calendarCard: {
    gap: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#fafafe",
    padding: 12,
  },
  rangeModes: {
    minHeight: 42,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f2f0fa",
    padding: 4,
  },
  rangeMode: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeModeActive: {
    backgroundColor: colors.card,
    ...shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  rangeModeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  rangeModeTextActive: {
    color: colors.primary,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  weekNames: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekName: {
    width: 36,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  day: {
    width: "12.7%",
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f8",
  },
  dayDone: {
    backgroundColor: colors.greenLight,
  },
  dayLight: {
    backgroundColor: colors.orangeLight,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayInRange: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  dayRangeStart: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayRangeEnd: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  dayTextDone: {
    color: "#047857",
  },
  dayTextToday: {
    color: colors.primary,
  },
  dayTextActive: {
    color: "#fff",
  },
  dayTextInRange: {
    color: colors.primary,
  },
  summaryCard: {
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryHeading: {
    marginTop: 3,
  },
  scoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenLight,
  },
  scoreValue: {
    color: "#047857",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },
  scoreLabel: {
    color: "#047857",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryHero: {
    borderRadius: 22,
    padding: 18,
  },
  summaryHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryKicker: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  summaryDate: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  summaryTitle: {
    marginTop: 10,
    color: "#fff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  summaryText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 19,
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 86,
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
  quickFixCard: {
    gap: 14,
  },
  quickFixHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickFixIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeLight,
  },
  correctionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wrong: {
    flex: 1,
    color: colors.red,
    textDecorationLine: "line-through",
    fontWeight: "700",
  },
  correct: {
    flex: 1,
    color: colors.green,
    fontWeight: "900",
  },
  practiceButton: {
    minHeight: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
  },
  practiceText: {
    color: "#fff",
    fontWeight: "900",
  },
  weakList: {
    marginTop: 14,
    gap: 10,
  },
  weakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "#fafafe",
    padding: 10,
  },
  weakCount: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  weakCountText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  weakTitle: {
    fontWeight: "900",
  },
  emptyWeak: {
    borderRadius: 16,
    backgroundColor: "#fafafe",
    padding: 14,
    gap: 4,
  },
});
