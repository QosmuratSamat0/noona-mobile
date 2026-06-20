import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MicButton } from "@/components/MicButton";
import { colors } from "@/constants/theme";
import { api } from "@/utils/api";
import { useAudio } from "@/hooks/useAudio";

const prompts = [
  { title: "Past events", text: "Tell me what you did yesterday before dinner." },
  { title: "Daily habits", text: "Describe one habit that helps you have a good day." },
  { title: "Future plans", text: "Tell me about something you want to do next month." },
];

type PracticeResult = { result_id: string; [key: string]: unknown };

export default function LessonSessionScreen() {
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [processing, setProcessing] = useState(false);
  const [sessionID, setSessionID] = useState("");
  const { startRecording, stopRecording } = useAudio();
  const prompt = prompts[step];

  useEffect(() => {
    api.post("/daily-sessions/start")
      .then((response) => setSessionID(response.data?.session_id || ""))
      .catch((error) => Alert.alert("Could not start lesson", error.response?.data?.error || "Please try again."));
  }, []);

  const finishTurn = (result: PracticeResult) => {
    if (step < prompts.length - 1) {
      setStep((value) => value + 1);
      setDraft("");
      setTyping(false);
      return;
    }
    const payload = JSON.stringify(result);
    if (Platform.OS === "web" && result.result_id) localStorage.setItem(`lesson-result:${result.result_id}`, payload);
    router.replace({ pathname: "/lesson/result", params: { result_id: result.result_id, result: payload } });
  };

  const submitText = async () => {
    if (!draft.trim() || !sessionID || processing) return;
    setProcessing(true);
    try {
      const response = await api.post("/practice/text", { text: draft.trim(), daily_session_id: sessionID });
      finishTurn(response.data);
    } catch (error: any) {
      Alert.alert("Could not check answer", error.response?.data?.error || "Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const submitVoice = async () => {
    if (!sessionID || processing) return;
    const uri = await stopRecording();
    if (!uri) return;
    setProcessing(true);
    try {
      const data = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        data.append("file", new File([blob], "classic.webm", { type: blob.type || "audio/webm" }));
      } else {
        data.append("file", { uri, name: "classic.m4a", type: "audio/m4a" } as any);
      }
      data.append("daily_session_id", sessionID);
      const response = await api.post("/practice/audio", data, { headers: { "Content-Type": "multipart/form-data" } });
      finishTurn(response.data);
    } catch (error: any) {
      Alert.alert("Could not check speech", error.response?.data?.error || "Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const close = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/lessons");

  return (
    <Screen scroll={false}>
      <View style={styles.top}>
        <Pressable onPress={close} style={styles.close}><Ionicons name="close" size={18} color={colors.text} /></Pressable>
        <View style={styles.badge}><Text style={styles.badgeText}>Classic</Text></View>
        <Text variant="caption">{step + 1} of {prompts.length}</Text>
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${((step + 1) / prompts.length) * 100}%` }]} /></View>

      <View style={styles.content}>
        <View><Text variant="eyebrow">Lesson</Text><Text variant="title">{prompt.title}</Text></View>
        <Card>
          <Text variant="eyebrow" style={{ color: colors.primary }}>Your prompt</Text>
          <Text style={styles.prompt}>{prompt.text}</Text>
        </Card>
        {processing && <Card style={styles.processing}><ActivityIndicator color={colors.primary} /><Text>Checking your English...</Text></Card>}
      </View>

      <View style={styles.inputArea}>
        {typing ? (
          <View style={styles.typeBox}>
            <TextInput value={draft} onChangeText={setDraft} editable={!processing} placeholder="Type your answer..." multiline style={styles.textInput} />
            <View style={styles.typeActions}>
              <Button variant="outline" onPress={() => setTyping(false)} style={{ flex: 0.35 }}>Voice</Button>
              <Button onPress={submitText} disabled={!draft.trim() || !sessionID || processing} style={{ flex: 1 }}>{processing ? "Checking..." : "Check my English"}</Button>
            </View>
          </View>
        ) : (
          <View style={styles.voiceBox}>
            <Text variant="caption">Hold the button and speak clearly</Text>
            <MicButton onStart={startRecording} onStop={submitVoice} disabled={!sessionID || processing} />
            <Text style={styles.hold}>Hold to speak</Text>
            <Pressable onPress={() => setTyping(true)} style={styles.typeInstead}>
              <Ionicons name="keypad-outline" size={14} color={colors.primary} />
              <Text style={styles.typeInsteadText}>Type instead</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 18 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  badge: { borderRadius: 999, backgroundColor: colors.primaryLight, paddingHorizontal: 14, paddingVertical: 7 },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  progress: { marginTop: 10, height: 7, borderRadius: 999, backgroundColor: colors.border },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
  content: { flex: 1, gap: 16, paddingTop: 18 },
  prompt: { marginTop: 8, fontSize: 18, lineHeight: 26, fontWeight: "700", textAlign: "center" },
  processing: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputArea: { marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  voiceBox: { alignItems: "center", gap: 12 },
  hold: { fontSize: 15, fontWeight: "800" },
  typeInstead: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  typeInsteadText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  typeBox: { gap: 12 },
  textInput: { minHeight: 92, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, backgroundColor: "#faf9ff", textAlignVertical: "top" },
  typeActions: { flexDirection: "row", gap: 10 },
});
