import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { api } from "@/utils/api";

type TalkMessage = {
  id: string;
  session_id: string;
  role: "user" | "ai";
  content: string;
  audio_url?: string;
  created_at?: string;
};

type TalkCorrection = {
  id: string;
  original: string;
  corrected: string;
  reason: string;
  pattern: string;
};

type TalkStats = {
  userTurns: number;
  aiTurns: number;
  words: number;
  corrections: number;
};

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const asString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

const parseCorrections = (value: string) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TalkCorrection => {
      return Boolean(item?.original && item?.corrected);
    });
  } catch {
    return [];
  }
};

const summarizeCorrection = (correction: TalkCorrection) => {
  const title = correction.pattern === "grammar" ? "Grammar pattern" : correction.pattern;
  return {
    ...correction,
    title,
  };
};

export default function TalkSummaryScreen() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [corrections, setCorrections] = useState<TalkCorrection[]>([]);
  const [error, setError] = useState("");

  const sessionID = asString(params.session_id);
  const startedAt = asString(params.started_at);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      setError("");

      try {
        let nextSessionID = sessionID;
        if (!nextSessionID) {
          const sessions = await api.get("/sessions");
          nextSessionID = sessions.data?.[0]?.id || "";
        }

        const paramCorrections = parseCorrections(asString(params.corrections));
        let cachedCorrections: TalkCorrection[] = [];
        if (Platform.OS === "web" && nextSessionID) {
          cachedCorrections = parseCorrections(localStorage.getItem(`freetalk-summary:${nextSessionID}`) || "");
        }

        setCorrections(paramCorrections.length ? paramCorrections : cachedCorrections);

        if (!nextSessionID) {
          setMessages([]);
          return;
        }

        const response = await api.get(`/sessions/${nextSessionID}/messages`);
        setMessages(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Failed to load talk summary", err);
        setError("Could not load this talk summary.");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [params.corrections, sessionID]);

  const stats = useMemo<TalkStats>(() => {
    const userMessages = messages.filter((message) => message.role === "user");
    const aiMessages = messages.filter((message) => message.role === "ai");
    return {
      userTurns: userMessages.length,
      aiTurns: aiMessages.length,
      words: userMessages.reduce((total, message) => total + wordCount(message.content), 0),
      corrections: corrections.length,
    };
  }, [messages, corrections]);

  const patterns = useMemo(() => {
    return corrections.map(summarizeCorrection).slice(0, 5);
  }, [corrections]);

  const startedLabel = useMemo(() => {
    if (!startedAt) return "This talk";
    const date = new Date(startedAt);
    if (Number.isNaN(date.getTime())) return "This talk";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [startedAt]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" style={{ color: colors.primary }}>Talk summary</Text>
          <Text variant="subtitle">Here is what Noona noticed</Text>
        </View>
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroLine}>
          <Ionicons name="sparkles" size={15} color="#fff" />
          <Text style={styles.heroSmall}>{startedLabel}</Text>
        </View>
        <Text style={styles.heroTitle}>
          {stats.corrections > 0 ? `${stats.corrections} useful ${stats.corrections === 1 ? "fix" : "fixes"}` : "Talk saved"}
        </Text>
        <Text style={styles.heroSub}>
          {stats.userTurns > 0
            ? `You sent ${stats.userTurns} ${stats.userTurns === 1 ? "message" : "messages"} and used ${stats.words} spoken words.`
            : "Start a conversation first, then Noona will summarize your patterns here."}
        </Text>
      </LinearGradient>

      <View style={styles.stats}>
        <Stat value={String(stats.userTurns)} label="Your turns" />
        <Stat value={String(stats.words)} label="Words" />
        <Stat value={String(stats.corrections)} label="Fixes" />
      </View>

      {loading ? (
        <Card style={styles.centerCard}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption">Loading summary...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.centerCard}>
          <Ionicons name="warning-outline" size={22} color={colors.red} />
          <Text variant="subtitle">{error}</Text>
          <Text variant="caption">Check that you are logged in and the backend is running.</Text>
        </Card>
      ) : patterns.length > 0 ? (
        patterns.map((pattern) => (
          <Card key={`${pattern.id}-${pattern.corrected}`}>
            <View style={styles.patternTop}>
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">{pattern.title}</Text>
                <Text variant="caption">{pattern.reason || "A clearer version of your sentence."}</Text>
              </View>
              <View style={styles.patternBadge}>
                <Text style={styles.patternBadgeText}>fix</Text>
              </View>
            </View>
            <View style={styles.fixBlock}>
              <View style={styles.fixLine}>
                <Text style={styles.fixLabel}>You said</Text>
                <Text style={styles.wrong}>{pattern.original}</Text>
              </View>
              <View style={styles.fixLine}>
                <Text style={styles.fixLabel}>Try</Text>
                <Text style={styles.correct}>{pattern.corrected}</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.centerCard}>
          <Ionicons name="checkmark-circle" size={24} color={colors.green} />
          <Text variant="subtitle">No major fixes this time</Text>
          <Text variant="caption" style={{ textAlign: "center" }}>
            Your talk is saved. Keep speaking and Noona will collect repeated patterns as they appear.
          </Text>
        </Card>
      )}

      <Card>
        <View style={styles.quickTop}>
          <View style={styles.quickIcon}>
            <Ionicons name="flash" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="subtitle">Fix in 3 minutes</Text>
            <Text variant="caption">Practice one short lesson based on this conversation.</Text>
          </View>
        </View>
        <Button
          onPress={() => {
            const first = patterns[0];
            router.push({
              pathname: "/lesson/practice",
              params: first
                ? {
                    original: first.original,
                    corrected: first.corrected,
                    reason: first.reason,
                    pattern: first.title,
                  }
                : {},
            });
          }}
          style={{ marginTop: 14 }}
        >
          Start quick fix
        </Button>
      </Card>

      <Button variant="outline" onPress={() => router.replace("/")}>
        Back home
      </Button>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  hero: {
    borderRadius: 28,
    padding: 20,
  },
  heroLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroSmall: {
    color: "#fff",
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 10,
    color: "#fff",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
  },
  heroSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.82)",
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 14,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  centerCard: {
    alignItems: "center",
    gap: 10,
  },
  patternTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  patternBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  patternBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  fixBlock: {
    marginTop: 14,
    gap: 10,
  },
  fixLine: {
    gap: 4,
  },
  fixLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  wrong: {
    color: colors.red,
    textDecorationLine: "line-through",
  },
  correct: {
    color: colors.primary,
    fontWeight: "900",
  },
  quickTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
});
