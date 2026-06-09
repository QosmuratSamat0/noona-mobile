import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";

export default function LessonResultScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.push("/")} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Feedback</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroLine}>
          <Ionicons name="sparkles" size={15} color="#fff" />
          <Text style={styles.heroSmall}>Nice try</Text>
        </View>
        <View style={styles.scoreRow}>
          <View>
            <Text style={styles.scoreLabel}>Your score</Text>
            <Text style={styles.score}>82</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.scoreLabel}>Main focus</Text>
            <Text style={styles.focus}>Past tense</Text>
          </View>
        </View>
      </LinearGradient>

      <Card>
        <Text variant="eyebrow">You said</Text>
        <Text style={styles.answer}>
          I <Text style={styles.wrong}>go</Text> to school yesterday.
        </Text>
      </Card>

      <Card style={styles.betterCard}>
        <Text variant="eyebrow" style={{ color: colors.primary }}>Better</Text>
        <Text style={styles.answer}>
          I <Text style={styles.betterWord}>went</Text> to school yesterday.
        </Text>
      </Card>

      <Card>
        <Text variant="subtitle">Why</Text>
        <Text variant="caption" style={{ marginTop: 6 }}>
          Use the past tense with yesterday. "Go" becomes "went".
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button variant="outline" onPress={() => router.push("/lesson/practice")} style={{ flex: 1 }}>
          Practice mistake
        </Button>
        <Button onPress={() => router.push("/lesson/summary")} style={{ flex: 1 }}>
          Next
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  hero: {
    borderRadius: 28,
    padding: 20,
  },
  heroLine: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  heroSmall: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  scoreRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  score: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
  },
  focus: {
    color: "#fff",
    fontWeight: "800",
  },
  answer: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
  },
  wrong: {
    color: colors.red,
    textDecorationLine: "line-through",
  },
  betterCard: {
    borderWidth: 2,
    borderColor: colors.primaryLight,
    backgroundColor: colors.primaryLight,
  },
  betterWord: {
    color: "#fff",
    backgroundColor: colors.primary,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
