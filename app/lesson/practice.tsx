import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MicButton } from "@/components/MicButton";
import { colors } from "@/constants/theme";
import { api } from "@/utils/api";
import { useAudio } from "@/hooks/useAudio";

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
  next_steps: string[];
};

const asString = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

const splitPattern = (value: string) => {
  const parts = value.split("->").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { from: parts[0], to: parts.slice(1).join(" -> ") };
  }
  return { from: "", to: value.trim() };
};

export default function PracticeMistakeScreen() {
  const params = useLocalSearchParams();
  const [mode, setMode] = useState<"fix" | "say">("fix");
  const [answer, setAnswer] = useState("");
  const [sessionID, setSessionID] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { startRecording, stopRecording } = useAudio();

  const pattern = asString(params.pattern) || "Quick fix";
  const paramOriginal = asString(params.original);
  const paramCorrected = asString(params.corrected);
  const sentence = asString(params.sentence);
  const betterSentence = asString(params.better_sentence);
  const hasConcreteCorrection = Boolean(paramOriginal && paramCorrected && paramOriginal !== paramCorrected);
  const hasSentenceContext = Boolean(sentence);
  const patternParts = splitPattern(pattern);
  const targetPhrase = paramCorrected || patternParts.to || pattern;
  const original = paramOriginal;
  const corrected = paramCorrected;
  const reason = asString(params.reason) || "Practice this pattern in your own sentence.";
  const mistakeIndex = asString(params.mistake_index) || "0";

  useEffect(() => {
    const startDailySession = async () => {
      setLoadingSession(true);
      try {
        const response = await api.post("/daily-sessions/start");
        setSessionID(response.data?.session_id || "");
      } catch (error: any) {
        Alert.alert("Could not start quick fix", error.response?.data?.error || "Please try again.");
      } finally {
        setLoadingSession(false);
      }
    };

    startDailySession();
  }, []);

  const prompt = useMemo(() => {
    if (hasConcreteCorrection) {
      if (mode === "say") {
        return betterSentence || corrected;
      }
      return hasSentenceContext
        ? `Rewrite the full sentence and improve "${original}" to "${corrected}".`
        : original;
    }
    return mode === "say"
      ? `Say one natural sentence using "${targetPhrase}".`
      : `Write one natural sentence using "${targetPhrase}".`;
  }, [betterSentence, corrected, hasConcreteCorrection, hasSentenceContext, mode, original, targetPhrase]);

  const openResult = (result: ResultResponse) => {
    const payload = JSON.stringify(result);
    if (Platform.OS === "web" && result.result_id) {
      try {
        localStorage.setItem(`lesson-result:${result.result_id}`, payload);
      } catch (error) {
        console.warn("Failed to cache lesson result", error);
      }
    }

    router.push({
      pathname: "/lesson/result",
      params: {
        result_id: result.result_id,
        result: payload,
        mistake_index: mistakeIndex,
      },
    });
  };

  const submitText = async () => {
    const text = (answer || (hasConcreteCorrection ? betterSentence || corrected : "")).trim();
    if (!text || !sessionID || submitting) return;

    setSubmitting(true);
    try {
      const response = await api.post("/practice/text", {
        text,
        daily_session_id: sessionID,
      });
      openResult(response.data);
    } catch (error: any) {
      Alert.alert("Quick fix failed", error.response?.data?.error || "Could not check your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartRecording = async () => {
    await startRecording();
  };

  const handleStopRecording = async () => {
    if (!sessionID || submitting) return;

    const uri = await stopRecording();
    if (!uri) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      let fileToUpload: any;

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const mimeType = blob.type || "audio/webm";
        fileToUpload = new File([blob], "quick-fix.webm", { type: mimeType });
      } else {
        fileToUpload = {
          uri,
          name: "quick-fix.m4a",
          type: "audio/m4a",
        };
      }

      formData.append("file", fileToUpload);
      formData.append("daily_session_id", sessionID);
      formData.append("fallback_text", hasConcreteCorrection ? betterSentence || corrected : "");

      const response = await api.post("/practice/audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      openResult(response.data);
    } catch (error: any) {
      Alert.alert("Quick fix failed", error.response?.data?.error || "Could not check your speech.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/progress");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" style={{ color: colors.primary }}>{pattern}</Text>
          <Text variant="subtitle">{hasSentenceContext ? "Practice this pattern" : hasConcreteCorrection ? "Practice this fix" : "Practice this pattern"}</Text>
        </View>
      </View>

      <Card style={styles.promptCard}>
        {hasSentenceContext ? (
          <>
            <Text variant="eyebrow" style={{ color: colors.primary }}>Your sentence</Text>
            <Text style={styles.fullSentence}>{sentence}</Text>
            {betterSentence && betterSentence !== sentence && (
              <>
                <View style={styles.divider} />
                <Text variant="eyebrow" style={{ color: colors.primary }}>Better sentence</Text>
                <Text style={styles.correct}>{betterSentence}</Text>
              </>
            )}
            {hasConcreteCorrection && (
              <>
                <View style={styles.divider} />
                <Text variant="eyebrow" style={{ color: colors.primary }}>Improve this part</Text>
                <View style={styles.patternRow}>
                  <Text style={styles.patternFrom}>{original}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.muted} />
                  <Text style={styles.patternTo}>{corrected}</Text>
                </View>
              </>
            )}
          </>
        ) : hasConcreteCorrection ? (
          <>
            <Text style={styles.wrong}>{original}</Text>
            <Text style={styles.correct}>{corrected}</Text>
          </>
        ) : (
          <>
            <Text variant="eyebrow" style={{ color: colors.primary }}>Use this naturally</Text>
            {patternParts.from ? (
              <View style={styles.patternRow}>
                <Text style={styles.patternFrom}>{patternParts.from}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.muted} />
                <Text style={styles.patternTo}>{patternParts.to}</Text>
              </View>
            ) : (
              <Text style={styles.correct}>{targetPhrase}</Text>
            )}
          </>
        )}
        <Text variant="caption" style={{ marginTop: hasConcreteCorrection || hasSentenceContext ? 8 : 2 }}>{reason}</Text>
      </Card>

      <View style={styles.toggle}>
        <Pressable onPress={() => setMode("fix")} style={[styles.toggleItem, mode === "fix" && styles.toggleActive]}>
          <Text style={[styles.toggleText, mode === "fix" && styles.toggleTextActive]}>
            {hasConcreteCorrection ? "Type improved sentence" : "Type example"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setMode("say")} style={[styles.toggleItem, mode === "say" && styles.toggleActive]}>
          <Text style={[styles.toggleText, mode === "say" && styles.toggleTextActive]}>
            {hasConcreteCorrection ? "Say improved sentence" : "Speak example"}
          </Text>
        </Pressable>
      </View>

      {loadingSession ? (
        <Card style={styles.statusCard}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption">Starting quick fix...</Text>
        </Card>
      ) : mode === "fix" ? (
        <Card>
          <Text variant="eyebrow">{hasConcreteCorrection ? "Write the improved sentence" : "Write your example"}</Text>
          <Text style={{ marginTop: 6 }}>{prompt}</Text>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder={hasConcreteCorrection ? "Type the improved sentence..." : "Type your own sentence..."}
            multiline
            style={styles.input}
          />
          <Button onPress={submitText} disabled={submitting || !sessionID || (!hasConcreteCorrection && !answer.trim())}>
            {submitting ? "Checking..." : "Check with Noona"}
          </Button>
        </Card>
      ) : (
        <Card style={styles.sayCard}>
          <Text variant="eyebrow">Say it correctly</Text>
          <Text variant="subtitle" style={{ textAlign: "center", marginTop: 8 }}>
            {hasConcreteCorrection ? `"${betterSentence || corrected}"` : `Use "${targetPhrase}" in your own sentence.`}
          </Text>
          {submitting ? (
            <View style={styles.statusCard}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption">Checking your speech...</Text>
            </View>
          ) : (
            <MicButton size={76} onStart={handleStartRecording} onStop={handleStopRecording} disabled={!sessionID} />
          )}
          <Text style={styles.hold}>Hold to speak</Text>
        </Card>
      )}
    </Screen>
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
  wrong: {
    color: colors.red,
    textDecorationLine: "line-through",
  },
  correct: {
    marginTop: 6,
    color: colors.primary,
    fontWeight: "900",
  },
  toggle: {
    flexDirection: "row",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.card,
    padding: 4,
  },
  toggleItem: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 10,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  toggleTextActive: {
    color: "#fff",
  },
  statusCard: {
    alignItems: "center",
    gap: 10,
  },
  input: {
    minHeight: 76,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#faf9ff",
    textAlignVertical: "top",
  },
  sayCard: {
    alignItems: "center",
    gap: 16,
  },
  hold: {
    fontSize: 13,
    fontWeight: "800",
  },
  promptCard: {
    gap: 4,
  },
  fullSentence: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    marginVertical: 8,
    backgroundColor: colors.border,
  },
  patternRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  patternFrom: {
    flexShrink: 1,
    color: colors.red,
    textDecorationLine: "line-through",
    fontWeight: "800",
  },
  patternTo: {
    flexShrink: 1,
    color: colors.primary,
    fontWeight: "900",
  },
});
