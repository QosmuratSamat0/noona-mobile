import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";
import { recentLessons } from "@/data/mock";

const month = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  return {
    day,
    done: [1, 2, 4, 5, 6, 9, 10, 11, 13, 14, 15, 17, 18, 20, 21].includes(day),
    missed: [3, 7, 8, 12, 19].includes(day),
    today: day === 22,
  };
});

export default function LessonsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="title">Your lessons</Text>
          <Text variant="caption">March 2026</Text>
        </View>
        <Pressable onPress={() => router.push("/lesson/start")} style={styles.add}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <Card>
        <View style={styles.weekNames}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <Text key={`${day}-${index}`} variant="caption" style={styles.center}>{day}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {month.map((item) => (
            <View
              key={item.day}
              style={[
                styles.day,
                item.done && styles.done,
                item.missed && styles.missed,
                item.today && styles.today,
              ]}
            >
              {item.done ? (
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
              ) : (
                <Text style={[styles.dayText, item.today && styles.todayText]}>{item.day}</Text>
              )}
            </View>
          ))}
        </View>
      </Card>

      <View>
        <Text variant="eyebrow" style={styles.recentLabel}>Recent</Text>
        <View style={styles.list}>
          {recentLessons.map((lesson) => (
            <Pressable key={lesson.id} onPress={() => router.push(`/lessons/${lesson.id}`)} style={styles.lesson}>
              <View style={{ flex: 1 }}>
                <Text variant="caption">
                  {lesson.date} - <Text style={styles.mode}>{lesson.mode}</Text>
                </Text>
                <Text variant="subtitle" style={styles.topic}>{lesson.topic}</Text>
                <Text variant="caption">{lesson.fixed} mistakes fixed</Text>
              </View>
              <View style={styles.scoreBox}>
                <Text style={styles.score}>{lesson.score}</Text>
                <Text variant="caption">score</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
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
  add: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  weekNames: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  center: {
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
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    backgroundColor: colors.primary,
  },
  missed: {
    backgroundColor: "#f1f0f7",
  },
  today: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  todayText: {
    color: colors.primary,
  },
  recentLabel: {
    marginBottom: 10,
  },
  list: {
    gap: 10,
  },
  lesson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 16,
  },
  mode: {
    color: colors.primary,
    fontWeight: "700",
  },
  topic: {
    marginTop: 3,
  },
  scoreBox: {
    alignItems: "flex-end",
  },
  score: {
    fontSize: 20,
    fontWeight: "800",
  },
});
