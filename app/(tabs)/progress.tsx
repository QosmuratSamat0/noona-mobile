import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors, shadow } from "@/constants/theme";
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

type DailySession = {
  session_id?: string;
  date: string;
  total_results: number;
  total_words: number;
  mistakes_count: number;
  avg_score: number;
  main_weak_point: string;
  summary: string;
  next_step: string;
};

type ResultListItem = {
  result_id: string;
  session_id?: string;
  original_text: string;
  corrected_text: string;
  score: number;
  created_at: string;
};

type ResultMistake = {
  type: string;
  title: string;
  original_text: string;
  corrected_text: string;
  explanation: string;
};

type ResultDetail = {
  result_id: string;
  original_text: string;
  corrected_text: string;
  score: number;
  mistakes?: ResultMistake[];
  next_steps?: string[];
};

type ChatSession = {
  id: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  role: "ai" | "user";
  content: string;
  created_at?: string;
  feedback?: {
    original?: string;
    corrected_text?: string;
    reason?: string;
  };
};

type ChatCorrection = {
  original: string;
  better: string;
  why: string;
  created_at: string;
};

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const currentDay = today.getDate();
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(today);
const shortMonthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(today);

const dateKey = (day: number) => {
  const month = String(currentMonth + 1).padStart(2, "0");
  const value = String(day).padStart(2, "0");
  return `${currentYear}-${month}-${value}`;
};

const localDateKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const dayFromDateKey = (value: string) => {
  const [, month, day] = value.split("-").map(Number);
  if (month !== currentMonth + 1 || !day) return null;
  return day;
};

const emptyDaily = (label: string): DailySession => ({
  date: label,
  total_results: 0,
  total_words: 0,
  mistakes_count: 0,
  avg_score: 0,
  main_weak_point: "No weak point yet",
  summary: "No practice data for this period yet.",
  next_step: "",
});

const aggregateDaily = (sessions: DailySession[], label: string): DailySession => {
  const practiced = sessions.filter((session) => session.total_results > 0);
  if (!practiced.length) return emptyDaily(label);

  const totalResults = practiced.reduce((total, session) => total + session.total_results, 0);
  const weightedScore = practiced.reduce((total, session) => total + session.avg_score * session.total_results, 0);
  const focus = practiced.find((session) => session.main_weak_point)?.main_weak_point || "Keep building consistency";
  const summary = practiced.length === 1
    ? practiced[0].summary
    : `You practiced on ${practiced.length} ${practiced.length === 1 ? "day" : "days"} in this period.`;

  return {
    session_id: practiced[0].session_id,
    date: label,
    total_results: totalResults,
    total_words: practiced.reduce((total, session) => total + session.total_words, 0),
    mistakes_count: practiced.reduce((total, session) => total + session.mistakes_count, 0),
    avg_score: totalResults > 0 ? Math.round(weightedScore / totalResults) : 0,
    main_weak_point: focus,
    summary,
    next_step: practiced.find((session) => session.next_step)?.next_step || "",
  };
};

const scoreTone = (score: number) => {
  if (score >= 85) return "Great progress";
  if (score >= 70) return "Good progress";
  if (score > 0) return "Good start";
  return "No score yet";
};

const compactExample = (original: string, corrected: string) => {
  const left = original.trim();
  const right = corrected.trim();
  if (!left && !right) return "";
  if (!left) return right;
  if (!right || left === right) return left;
  return `${left} -> ${right}`;
};

const splitArrow = (value: string) => {
  const parts = value.split("->").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  return { original: parts[0], corrected: parts[1] };
};

const colorWords = new Set(["black", "blue", "brown", "gray", "green", "grey", "orange", "pink", "purple", "red", "violet", "white", "yellow"]);

const correctionCategory = (value: {
  title?: string;
  type?: string;
  original?: string;
  corrected?: string;
}) => {
  const title = (value.title || "").toLowerCase();
  const type = (value.type || "").toLowerCase();
  const original = (value.original || "").toLowerCase();
  const corrected = (value.corrected || "").toLowerCase();
  const text = `${title} ${type} ${original} ${corrected}`;

  if (colorWords.has(original) && colorWords.has(corrected)) return "Color words";
  if (text.includes("what should") || text.includes("question") || text.includes("auxiliary")) return "Question structure";
  if (text.includes("pronunciation")) return "Pronunciation";
  if (text.includes("natural") || text.includes("phrase") || text.includes("everyone") || text.includes("every people")) return "Natural phrasing";
  if (type === "vocabulary" || text.includes("vocabulary")) return "Vocabulary";
  if (text.includes("tense") || text.includes("verb")) return "Verb tense";
  return "Grammar pattern";
};

const cleanReason = (detail: ResultDetail | null, mistake?: ResultMistake) => {
  const reason = mistake?.explanation || detail?.next_steps?.[0] || "Use the better version in your next answer.";
  return reason.replace(/\s+/g, " ").trim();
};

export default function ProgressScreen() {
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [selectedDaily, setSelectedDaily] = useState<DailySession | null>(null);
  const [selectedResult, setSelectedResult] = useState<ResultDetail | null>(null);
  const [selectedChatCorrection, setSelectedChatCorrection] = useState<ChatCorrection | null>(null);
  const [selectionMode, setSelectionMode] = useState<"day" | "week" | "month">("day");
  const [rangeStart, setRangeStart] = useState(currentDay);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []));

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
  }, [refreshKey]);

  const selectedEnd = rangeEnd ?? rangeStart;
  const isRange = selectedEnd !== rangeStart;
  const selectedLabel = isRange ? `${shortMonthLabel} ${rangeStart} - ${shortMonthLabel} ${selectedEnd}` : `${shortMonthLabel} ${rangeStart}`;
  const summaryTitleLabel =
    selectionMode === "month" ? "Monthly summary" : selectionMode === "week" ? "Weekly summary" : "Daily summary";
  const scoreHeading =
    selectionMode === "month" ? "Monthly score" : selectionMode === "week" ? "Weekly score" : "Daily score";

  useEffect(() => {
    let cancelled = false;

    const loadDailyRange = async () => {
      const days = Array.from({ length: selectedEnd - rangeStart + 1 }, (_, index) => rangeStart + index);
      try {
        const responses = await Promise.all(
          days.map((day) =>
            api
              .get("/daily-sessions", { params: { date: dateKey(day) } })
              .then((response) => response.data as DailySession | null)
              .catch((error) => {
                if (isUnauthorizedError(error)) throw error;
                console.error("Failed to load daily session", dateKey(day), error);
                return null;
              }),
          ),
        );
        const sessions = responses.filter(Boolean) as DailySession[];
        const nextDaily = aggregateDaily(sessions, selectedLabel);
        let nextResult: ResultDetail | null = null;
        let nextChatCorrection: ChatCorrection | null = null;
        const sessionIDs = sessions.map((session) => session.session_id).filter(Boolean) as string[];
        if (sessionIDs.length) {
          const resultLists = await Promise.all(
            sessionIDs.map((sessionID) =>
              api
                .get("/results", { params: { session_id: sessionID } })
                .then((response) => Array.isArray(response.data) ? response.data as ResultListItem[] : [])
                .catch((error) => {
                  if (isUnauthorizedError(error)) throw error;
                  console.error("Failed to load session results", sessionID, error);
                  return [];
                }),
            ),
          );
          const latest = resultLists
            .flat()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          if (latest?.result_id) {
            nextResult = await api
              .get(`/results/${latest.result_id}`)
              .then((response) => response.data as ResultDetail)
              .catch((error) => {
                if (isUnauthorizedError(error)) throw error;
                console.error("Failed to load result detail", latest.result_id, error);
                return null;
              });
          }
        }
        const selectedDateKeys = new Set(days.map(dateKey));
        const chatSessions = await api
          .get("/sessions")
          .then((response) => Array.isArray(response.data) ? response.data as ChatSession[] : [])
          .catch((error) => {
            if (isUnauthorizedError(error)) throw error;
            console.error("Failed to load chat sessions for progress", error);
            return [];
          });
        const matchingChatSessions = chatSessions.filter((session) => selectedDateKeys.has(localDateKey(session.created_at)));
        if (matchingChatSessions.length) {
          const messageGroups = await Promise.all(
            matchingChatSessions.map((session) =>
              api
                .get(`/sessions/${session.id}/messages`)
                .then((response) => Array.isArray(response.data) ? response.data as ChatMessage[] : [])
                .catch((error) => {
                  if (isUnauthorizedError(error)) throw error;
                  console.error("Failed to load chat messages for progress", session.id, error);
                  return [];
                }),
            ),
          );
          nextChatCorrection = messageGroups
            .flat()
            .filter((message) => {
              const feedback = message.feedback;
              return message.role === "user" && Boolean(feedback?.original && feedback.corrected_text && feedback.original !== feedback.corrected_text);
            })
            .map((message) => ({
              original: message.feedback?.original || message.content,
              better: message.feedback?.corrected_text || message.content,
              why: message.feedback?.reason || "Use the better version in your next answer.",
              created_at: message.created_at || "",
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
        }
        if (!cancelled) {
          setSelectedDaily(nextDaily);
          setSelectedResult(nextResult);
          setSelectedChatCorrection(nextChatCorrection);
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await removeToken();
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          console.error("Failed to load selected progress range", error);
          setSelectedDaily(emptyDaily(selectedLabel));
          setSelectedResult(null);
          setSelectedChatCorrection(null);
        }
      }
    };

    loadDailyRange();

    return () => {
      cancelled = true;
    };
  }, [rangeStart, refreshKey, selectedEnd, selectedLabel]);

  const focus = selectedDaily?.main_weak_point || analysis?.daily?.main_weak_point || analysis?.focus || "No weak point yet";
  const summary = selectedDaily?.summary || analysis?.daily?.summary || analysis?.reason || "Your summary will appear after practice.";
  const score = selectedDaily?.avg_score ?? analysis?.daily?.avg_score ?? 0;
  const sessions = selectedDaily?.total_results ?? analysis?.daily?.total_results ?? 0;
  const words = selectedDaily?.total_words ?? analysis?.daily?.total_words ?? 0;
  const fixes = selectedDaily?.mistakes_count ?? analysis?.daily?.mistakes_count ?? 0;
  const mainMistake = selectedResult?.mistakes?.[0];
  const mainCorrection = selectedResult
    ? {
        original: selectedResult.original_text,
        better: selectedResult.corrected_text,
        why: cleanReason(selectedResult, mainMistake),
        category: correctionCategory({
          title: mainMistake?.title,
          type: mainMistake?.type,
          original: mainMistake?.original_text,
          corrected: mainMistake?.corrected_text,
        }),
      }
    : selectedChatCorrection
      ? {
          original: selectedChatCorrection.original,
          better: selectedChatCorrection.better,
          why: selectedChatCorrection.why,
          category: correctionCategory({
            original: selectedChatCorrection.original,
            corrected: selectedChatCorrection.better,
          }),
        }
    : null;

  const activeDays = useMemo(() => {
    const days = new Set<number>();
    activity?.daily_stats?.forEach((stat) => {
      const day = dayFromDateKey(stat.date);
      if (day && stat.session_count > 0) {
        days.add(day);
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
    const resultMistakes = selectedResult?.mistakes || [];
    if (resultMistakes.length) {
      return resultMistakes.slice(0, 3).map((mistake, index) => ({
        key: `${mistake.title}-${index}`,
        title: correctionCategory({
          title: mistake.title,
          type: mistake.type,
          original: mistake.original_text,
          corrected: mistake.corrected_text,
        }),
        example: compactExample(mistake.original_text, mistake.corrected_text),
        reason: mistake.explanation || "Practice this pattern in one more sentence.",
        count: index + 1,
      }));
    }
    if (selectedChatCorrection) {
      return [{
        key: "chat-correction",
        title: correctionCategory({
          original: selectedChatCorrection.original,
          corrected: selectedChatCorrection.better,
        }),
        example: compactExample(selectedChatCorrection.original, selectedChatCorrection.better),
        reason: selectedChatCorrection.why,
        count: 1,
      }];
    }
    if (!analysis?.top_mistakes?.length) {
      return [];
    }
    return analysis.top_mistakes.slice(0, 3).map((mistake, index) => {
      const arrow = splitArrow(mistake.title);
      return {
        key: `${mistake.title}-${index}`,
        title: correctionCategory({
          title: mistake.title,
          original: arrow?.original,
          corrected: arrow?.corrected,
        }),
        example: arrow ? compactExample(arrow.original, arrow.corrected) : mistake.title,
        reason: mistake.message || "This pattern appeared in your practice.",
        count: mistake.recent_count || mistake.total_count || index + 1,
      };
    });
  }, [analysis, selectedChatCorrection, selectedResult]);

  const mainFix = weakPoints[0];

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

    setRangeStart(day);
    setRangeEnd(null);
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
            <Text variant="caption">Your speaking at a glance</Text>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={15} color={colors.orange} />
            <Text style={styles.streakText}>{analysis?.activity?.current_streak ?? 0}</Text>
            <Text variant="caption">days</Text>
          </View>
        </View>

        <Pressable onPress={() => setCalendarOpen((value) => !value)} style={styles.calendarHeader}>
          <View>
            <Text style={styles.periodLabel}>{selectedLabel}</Text>
            <Text variant="caption">{summaryTitleLabel}</Text>
          </View>
          <View style={styles.calendarAction}>
            <Ionicons name="calendar-clear-outline" size={19} color={colors.primary} />
            <Ionicons name={calendarOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.muted} />
          </View>
        </Pressable>
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
        {calendarOpen && (
          <View style={styles.calendarBody}>
            <Text variant="subtitle">{monthLabel}</Text>
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
          </View>
        )}
      </Card>

      <Card style={styles.scoreCard}>
        <View style={styles.scoreTop}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text variant="eyebrow">{scoreHeading}</Text>
            <Text style={styles.scoreTone}>{scoreTone(score)}</Text>
            <Text variant="caption" numberOfLines={1}>{selectedLabel}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <SummaryMetric value={String(sessions)} label="Answers" icon="radio-outline" />
          <SummaryMetric value={String(words)} label="Words" icon="chatbox-outline" />
          <SummaryMetric value={String(fixes)} label="Fixes" icon="construct-outline" />
        </View>
      </Card>

      <Card style={styles.correctionCard}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="sparkles" size={15} color={colors.primary} />
            </View>
            <View>
              <Text variant="subtitle">Focus</Text>
              <Text variant="caption">{mainCorrection?.category || focus}</Text>
            </View>
          </View>
        </View>

        {mainCorrection && mainCorrection.original !== mainCorrection.better ? (
          <>
            <CorrectionBlock label="You said" text={mainCorrection.original} tone="wrong" />
            <View style={styles.correctionArrow}>
              <Ionicons name="arrow-down" size={14} color={colors.primary} />
            </View>
            <CorrectionBlock label="Say this" text={mainCorrection.better} tone="correct" />
            <Text variant="caption" numberOfLines={2}>{mainCorrection.why}</Text>
            <Pressable onPress={() => openQuickFix(mainFix)} style={styles.practiceButton}>
              <Text style={styles.practiceText}>Practice</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyWeak}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <View style={styles.emptyCopy}>
              <Text style={styles.weakTitle}>{focus}</Text>
              <Text variant="caption" numberOfLines={2}>{summary}</Text>
            </View>
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.sectionRow}>
          <Text variant="subtitle">Needs practice</Text>
          <Text variant="caption">{weakPoints.length ? `Top ${Math.min(weakPoints.length, 2)}` : "All clear"}</Text>
        </View>
        <View style={styles.weakList}>
          {weakPoints.length > 0 ? weakPoints.slice(0, 2).map((mistake) => (
            <Pressable key={mistake.key} onPress={() => openQuickFix(mistake)} style={styles.weakRow}>
              <View style={styles.weakCount}>
                <Text style={styles.weakCountText}>{mistake.count}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.weakTitle} numberOfLines={1}>{mistake.title}</Text>
                <Text variant="caption" numberOfLines={1}>{mistake.example || mistake.reason}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
          )) : (
            <View style={styles.emptyWeak}>
              <Ionicons name="checkmark-circle" size={20} color={colors.green} />
              <View style={styles.emptyCopy}>
                <Text style={styles.weakTitle}>Nothing to review</Text>
                <Text variant="caption">Your next correction will appear here.</Text>
              </View>
            </View>
          )}
        </View>
      </Card>
    </Screen>
  );
}

function CorrectionBlock({ label, text, tone }: { label: string; text: string; tone: "wrong" | "correct" }) {
  return (
    <View style={styles.correctionBlock}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={tone === "wrong" ? styles.originalText : styles.betterText}>{text}</Text>
    </View>
  );
}

function SummaryMetric({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={14} color={colors.primary} />
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
    gap: 10,
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
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
  scoreCard: {
    gap: 14,
  },
  scoreTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreCopy: {
    flex: 1,
    minWidth: 0,
  },
  scoreTone: {
    marginTop: 4,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
  },
  scoreCircle: {
    width: 76,
    height: 76,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: "#fafafe",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  metricIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
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
  correctionCard: {
    gap: 14,
  },
  correctionBlock: {
    gap: 5,
    borderRadius: 14,
    backgroundColor: "#fafafe",
    padding: 12,
  },
  calendarAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calendarBody: {
    gap: 10,
    paddingTop: 4,
  },
  periodLabel: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  blockLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  originalText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  betterText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "900",
  },
  correctionArrow: {
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceButton: {
    minHeight: 46,
    borderRadius: 16,
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#fafafe",
    padding: 14,
    gap: 10,
  },
  emptyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
