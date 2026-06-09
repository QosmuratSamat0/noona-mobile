import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";

const skills = [
  { label: "Speaking", value: 72, delta: 12 },
  { label: "Vocabulary", value: 64, delta: 8 },
  { label: "Grammar", value: 58, delta: 4 },
  { label: "Fluency", value: 66, delta: 6 },
  { label: "Pronunciation", value: 70, delta: 3 },
];

const mistakes = [
  { wrong: "I am agree", correct: "I agree" },
  { wrong: "yesterday I go", correct: "yesterday I went" },
  { wrong: "in Monday", correct: "on Monday" },
];

export default function ProgressScreen() {
  return (
    <Screen>
      <View>
        <Text variant="title">Your progress</Text>
        <Text variant="caption">How you are improving this week</Text>
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroRow}>
          <Ionicons name="trending-up" size={16} color="#fff" />
          <Text style={styles.heroCaption}>This week</Text>
        </View>
        <Text style={styles.heroTitle}>Speaking +12%</Text>
        <Text style={styles.heroSub}>+34 new words - 7 mistakes fixed</Text>
      </LinearGradient>

      <Card>
        <Text variant="subtitle">Skills</Text>
        <View style={styles.skills}>
          {skills.map((skill) => (
            <View key={skill.label}>
              <View style={styles.skillRow}>
                <Text style={styles.skillLabel}>{skill.label}</Text>
                <Text style={styles.delta}>+{skill.delta}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${skill.value}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="subtitle">Common mistakes</Text>
        <View style={styles.mistakes}>
          {mistakes.map((mistake, index) => (
            <View key={mistake.wrong} style={styles.mistakeRow}>
              <Text variant="caption">{index + 1}.</Text>
              <Text style={styles.wrong}>{mistake.wrong}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.muted} />
              <Text style={styles.correct}>{mistake.correct}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="eyebrow" style={{ color: colors.primary }}>Weak point</Text>
        <Text variant="subtitle" style={{ marginTop: 4 }}>Past tense</Text>
        <Text variant="caption" style={{ marginTop: 4 }}>
          Recommended: Role-play - Talking about yesterday
        </Text>
        <Pressable onPress={() => router.push("/lesson/practice")} style={styles.practice}>
          <Text style={styles.practiceText}>Practice weak point</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28,
    padding: 20,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroCaption: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 8,
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },
  heroSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
  },
  skills: {
    marginTop: 14,
    gap: 14,
  },
  skillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  skillLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  delta: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "800",
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#f1f0f7",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  mistakes: {
    marginTop: 12,
    gap: 10,
  },
  mistakeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wrong: {
    color: colors.red,
    textDecorationLine: "line-through",
  },
  correct: {
    color: colors.primary,
    fontWeight: "800",
  },
  practice: {
    marginTop: 14,
    height: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
  },
  practiceText: {
    color: "#fff",
    fontWeight: "800",
  },
});
