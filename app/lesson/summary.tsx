import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { StatPill } from "@/components/StatPill";
import { colors } from "@/constants/theme";

export default function LessonSummaryScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.trophy}>
          <Ionicons name="trophy" size={32} color={colors.primary} />
        </View>
        <Text variant="title" style={{ textAlign: "center", marginTop: 14 }}>
          Daily Lesson Complete
        </Text>
        <Text variant="caption" style={{ textAlign: "center", marginTop: 4 }}>
          Nice work, Ayan. Small steps every day.
        </Text>
      </View>

      <Card>
        <View style={styles.scoreRow}>
          <View>
            <Text variant="eyebrow">Score</Text>
            <Text style={styles.score}>82</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text variant="eyebrow">Main focus</Text>
            <Text style={styles.focus}>Past tense</Text>
          </View>
        </View>
      </Card>

      <View style={styles.stats}>
        <StatPill value="3" label="Exercises" />
        <StatPill value="47" label="Words" />
        <StatPill value="2" label="Fixed" />
      </View>

      <Card>
        <Text variant="eyebrow" style={{ color: colors.green }}>Best improvement</Text>
        <Text variant="subtitle" style={{ marginTop: 4 }}>Articles (a / the)</Text>
        <Text variant="caption">+18% accuracy vs yesterday</Text>
      </Card>

      <View style={styles.actions}>
        <Button variant="outline" onPress={() => router.push("/lessons")} style={{ flex: 1 }}>
          View details
        </Button>
        <Button onPress={() => router.push("/")} style={{ flex: 1 }}>
          Done
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    paddingTop: 20,
  },
  trophy: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  score: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 34,
    fontWeight: "900",
  },
  focus: {
    marginTop: 4,
    fontWeight: "800",
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
