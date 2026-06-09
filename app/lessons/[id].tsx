import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";

const exercises = [
  { prompt: "Tell me about your day", focus: "Past tense" },
  { prompt: "Describe your favorite food", focus: "Articles" },
  { prompt: "Make a plan for tomorrow", focus: "Future forms" },
];

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <View>
        <Text variant="title">Lesson detail</Text>
        <Text variant="caption">Mar {id} - Classic</Text>
      </View>

      <Card>
        <View style={styles.stats}>
          <View>
            <Text variant="eyebrow">Score</Text>
            <Text style={styles.score}>82</Text>
          </View>
          <View>
            <Text variant="eyebrow">Words</Text>
            <Text style={styles.metric}>47</Text>
          </View>
          <View>
            <Text variant="eyebrow">Fixed</Text>
            <Text style={styles.metric}>3</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="subtitle">Exercises</Text>
        <View style={styles.list}>
          {exercises.map((exercise, index) => (
            <View key={exercise.prompt} style={styles.exercise}>
              <View style={styles.num}>
                <Text style={styles.numText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prompt}>{exercise.prompt}</Text>
                <Text variant="caption">Focus - {exercise.focus}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="subtitle">Main correction</Text>
        <View style={styles.fixRow}>
          <Text style={styles.wrong}>I go yesterday</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.muted} />
          <Text style={styles.correct}>I went yesterday</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button variant="outline" onPress={() => router.push("/lesson/start")} style={{ flex: 1 }}>
          Practice again
        </Button>
        <Button onPress={() => router.push("/lesson/practice")} style={{ flex: 1 }}>
          Weak point
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  score: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: "900",
  },
  metric: {
    fontSize: 24,
    fontWeight: "900",
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  exercise: {
    flexDirection: "row",
    gap: 10,
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  numText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  prompt: {
    fontWeight: "800",
  },
  fixRow: {
    marginTop: 12,
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
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
