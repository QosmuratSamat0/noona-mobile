import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MicButton } from "@/components/MicButton";
import { colors } from "@/constants/theme";

export default function PracticeMistakeScreen() {
  const [mode, setMode] = useState<"fix" | "say">("fix");
  const [answer, setAnswer] = useState("");
  const [done, setDone] = useState(false);

  const check = () => setDone(answer.trim().toLowerCase().includes("went"));

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View>
          <Text variant="eyebrow" style={{ color: colors.primary }}>Past tense</Text>
          <Text variant="subtitle">Practice this mistake</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.wrong}>I go to school yesterday.</Text>
        <Text style={styles.correct}>I went to school yesterday.</Text>
        <Text variant="caption" style={{ marginTop: 8 }}>
          Use past tense with yesterday.
        </Text>
      </Card>

      <View style={styles.toggle}>
        <Pressable onPress={() => { setMode("fix"); setDone(false); }} style={[styles.toggleItem, mode === "fix" && styles.toggleActive]}>
          <Text style={[styles.toggleText, mode === "fix" && styles.toggleTextActive]}>Fix the sentence</Text>
        </Pressable>
        <Pressable onPress={() => { setMode("say"); setDone(false); }} style={[styles.toggleItem, mode === "say" && styles.toggleActive]}>
          <Text style={[styles.toggleText, mode === "say" && styles.toggleTextActive]}>Say it correctly</Text>
        </Pressable>
      </View>

      {done ? (
        <Card style={styles.done}>
          <Ionicons name="checkmark-circle" size={44} color={colors.green} />
          <Text variant="subtitle" style={{ marginTop: 8 }}>Great. You fixed it.</Text>
          <Text variant="caption" style={{ textAlign: "center", marginTop: 4 }}>
            Keep going - small wins add up.
          </Text>
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => { setDone(false); setAnswer(""); }} style={{ flex: 1 }}>
              Again
            </Button>
            <Button onPress={() => router.push("/lesson/session")} style={{ flex: 1 }}>
              Back
            </Button>
          </View>
        </Card>
      ) : mode === "fix" ? (
        <Card>
          <Text variant="eyebrow">Fix this</Text>
          <Text style={{ marginTop: 6 }}>I go to school yesterday.</Text>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder="Type the correct sentence..."
            multiline
            style={styles.input}
          />
          <Button onPress={check}>Check</Button>
        </Card>
      ) : (
        <Card style={styles.sayCard}>
          <Text variant="eyebrow">Say it correctly</Text>
          <Text variant="subtitle" style={{ textAlign: "center", marginTop: 8 }}>
            "I went to school yesterday."
          </Text>
          <MicButton size={76} onStop={() => setDone(true)} />
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
  done: {
    alignItems: "center",
    backgroundColor: colors.greenLight,
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
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
});
