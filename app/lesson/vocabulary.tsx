import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors, radius, shadow } from "@/constants/theme";
import { api } from "@/utils/api";

type Task = {
  type: "choice" | "write";
  word: string;
  prompt: string;
  options?: string[];
  answer?: string;
  explanation: string;
};

const tasks: Task[] = [
  { type: "choice", word: "reliable", prompt: "Which meaning is correct?", options: ["Can be trusted", "Very expensive", "Hard to understand"], answer: "Can be trusted", explanation: "Reliable describes someone or something you can trust." },
  { type: "choice", word: "clear", prompt: "The instructions were ___, so everyone understood them.", options: ["clear", "heavy", "quiet"], answer: "clear", explanation: "Clear instructions are easy to understand." },
  { type: "choice", word: "exhausted", prompt: "Choose a stronger alternative to 'very tired'.", options: ["exhausted", "careful", "ordinary"], answer: "exhausted", explanation: "Exhausted means extremely tired." },
  { type: "write", word: "improve", prompt: "Write one natural sentence using 'improve'.", explanation: "Using a word in your own sentence helps you remember it." },
];

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

export default function VocabularyDrillScreen() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [sentence, setSentence] = useState("");
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionID, setSessionID] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  const task = tasks[index];
  const isWriting = task.type === "write";
  const writingValid = isWriting && countWords(sentence) >= 4 && sentence.toLowerCase().includes(task.word);
  const answerCorrect = isWriting ? writingValid : selected === task.answer;
  const score = useMemo(() => Math.round((correctCount / tasks.length) * 100), [correctCount]);

  useEffect(() => {
    api.post("/daily-sessions/start")
      .then((response) => setSessionID(response.data?.session_id || ""))
      .catch(() => setSessionID(""));
  }, []);

  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/lessons");

  const checkAnswer = () => {
    if (checked || (!selected && !isWriting) || (isWriting && !sentence.trim())) return;
    setChecked(true);
    if (answerCorrect) setCorrectCount((value) => value + 1);
  };

  const next = async () => {
    if (index < tasks.length - 1) {
      setIndex((value) => value + 1);
      setSelected("");
      setSentence("");
      setChecked(false);
      return;
    }
    setSaving(true);
    if (sessionID && sentence.trim()) {
      try {
        await api.post("/practice/text", { text: sentence.trim(), daily_session_id: sessionID });
      } catch {
        // The local drill remains usable when progress sync is unavailable.
      }
    }
    setSaving(false);
    setComplete(true);
  };

  const restart = () => {
    setIndex(0);
    setSelected("");
    setSentence("");
    setChecked(false);
    setCorrectCount(0);
    setComplete(false);
  };

  if (complete) {
    return (
      <Screen>
        <Header title="Vocabulary drill" onBack={goBack} close />
        <View style={styles.resultPanel}>
          <View style={styles.resultIcon}><Ionicons name="checkmark" size={30} color="#fff" /></View>
          <Text variant="title">Drill complete</Text>
          <Text style={styles.score}>{score}</Text>
          <Text variant="caption" style={styles.center}>You practiced {tasks.length} words and used one in your own sentence.</Text>
        </View>
        <View style={styles.summaryRow}>
          <Stat value={correctCount} label="Correct" />
          <Stat value={tasks.length - correctCount} label="Review" />
          <Stat value={tasks.length} label="Words" />
        </View>
        <Button onPress={() => router.replace("/(tabs)/progress")}>View progress</Button>
        <Button variant="outline" onPress={restart}>Practice again</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Vocabulary drill" subtitle={`Word ${index + 1} of ${tasks.length}`} onBack={goBack} />
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / tasks.length) * 100}%` }]} /></View>

      <View style={styles.wordPanel}>
        <View style={styles.wordIcon}><Ionicons name="sparkles-outline" size={21} color="#7c3aed" /></View>
        <Text style={styles.word}>{task.word}</Text>
        <Text style={styles.prompt}>{task.prompt}</Text>
      </View>

      {task.type === "choice" ? (
        <View style={styles.options}>
          {task.options?.map((option) => {
            const active = selected === option;
            const correct = checked && option === task.answer;
            const wrong = checked && active && option !== task.answer;
            return (
              <Pressable key={option} disabled={checked} onPress={() => setSelected(option)} style={[styles.option, active && styles.optionActive, correct && styles.optionCorrect, wrong && styles.optionWrong]}>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {(correct || wrong) && <Ionicons name={correct ? "checkmark" : "close"} size={15} color="#fff" />}
                </View>
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput value={sentence} onChangeText={setSentence} editable={!checked} multiline placeholder="I want to improve my English..." placeholderTextColor="#9ca3af" style={[styles.input, checked && (writingValid ? styles.inputCorrect : styles.inputWrong)]} />
      )}

      {checked && (
        <View style={[styles.feedback, answerCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
          <Ionicons name={answerCorrect ? "checkmark-circle" : "refresh-circle"} size={22} color={answerCorrect ? colors.green : colors.orange} />
          <View style={styles.feedbackCopy}>
            <Text style={styles.feedbackTitle}>{answerCorrect ? "Correct" : "Review this word"}</Text>
            <Text variant="caption">{task.explanation}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        {!checked ? (
          <Button onPress={checkAnswer} disabled={task.type === "choice" ? !selected : !sentence.trim()}>Check answer</Button>
        ) : (
          <Button onPress={next} disabled={saving}>{saving ? "Saving..." : index === tasks.length - 1 ? "Finish drill" : "Next word"}</Button>
        )}
        {saving && <ActivityIndicator color={colors.primary} />}
      </View>
    </Screen>
  );
}

function Header({ title, subtitle, onBack, close = false }: { title: string; subtitle?: string; onBack: () => void; close?: boolean }) {
  return <View style={styles.header}>
    <Pressable onPress={onBack} style={styles.iconButton}><Ionicons name={close ? "close" : "arrow-back"} size={19} color={colors.text} /></Pressable>
    <View style={styles.headerCopy}><Text variant="subtitle">{title}</Text>{subtitle && <Text variant="caption">{subtitle}</Text>}</View>
  </View>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text variant="caption">{label}</Text></View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  headerCopy: { flex: 1 },
  progressTrack: { height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: "#e7e5f4" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
  wordPanel: { minHeight: 190, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: colors.card, ...shadow },
  wordIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#f3e8ff" },
  word: { marginTop: 12, color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  prompt: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  options: { gap: 10 },
  option: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionCorrect: { borderColor: colors.green, backgroundColor: colors.greenLight },
  optionWrong: { borderColor: colors.red, backgroundColor: colors.redLight },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#d6d3e5", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  input: { minHeight: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 15, color: colors.text, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
  inputCorrect: { borderColor: colors.green, backgroundColor: colors.greenLight },
  inputWrong: { borderColor: colors.orange, backgroundColor: colors.orangeLight },
  feedback: { borderRadius: radius.md, padding: 14, flexDirection: "row", gap: 10 },
  feedbackCorrect: { backgroundColor: colors.greenLight },
  feedbackWrong: { backgroundColor: colors.orangeLight },
  feedbackCopy: { flex: 1, gap: 3 },
  feedbackTitle: { color: colors.text, fontWeight: "900" },
  footer: { marginTop: "auto", gap: 10 },
  resultPanel: { minHeight: 280, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: colors.card, padding: 24, ...shadow },
  resultIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.green, marginBottom: 14 },
  score: { marginTop: 10, color: colors.primary, fontSize: 48, lineHeight: 56, fontWeight: "900" },
  center: { marginTop: 4, maxWidth: 280, textAlign: "center" },
  summaryRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, minHeight: 78, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.card },
  statValue: { color: colors.text, fontSize: 21, fontWeight: "900" },
});
