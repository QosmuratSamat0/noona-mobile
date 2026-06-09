import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatPill } from "@/components/StatPill";
import { colors, radius, shadow } from "@/constants/theme";
import { week } from "@/data/mock";

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="caption">Good morning</Text>
          <Text variant="title">Ayan</Text>
        </View>
        <View style={styles.streak}>
          <Ionicons name="flame" size={16} color={colors.orange} />
          <Text style={styles.streakText}>5</Text>
        </View>
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={12} color="#fff" />
          <Text style={styles.heroBadgeText}>Recommended for you</Text>
        </View>
        <Text style={styles.heroTitle}>Past tense in everyday talk</Text>
        <Text style={styles.heroSub}>Based on mistakes from your Free Talk</Text>
        <View style={styles.tags}>
          {["past tense", "articles", "word order"].map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaText}>3 short exercises</Text>
          <Text style={styles.heroMetaText}>Not started</Text>
        </View>
        <Button variant="secondary" onPress={() => router.push("/lesson/start")} style={styles.heroButton}>
          Start Lesson
        </Button>
      </LinearGradient>

      <View style={styles.stats}>
        <StatPill value="5" label="Day streak" />
        <StatPill value="0/3" label="Exercises" />
        <StatPill value="0" label="Words" />
      </View>

      <Card>
        <View style={styles.sectionRow}>
          <Text variant="subtitle">This week</Text>
          <Pressable onPress={() => router.push("/lessons")}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {week.map((item, index) => (
            <View key={`${item.day}-${index}`} style={styles.weekItem}>
              <Text variant="caption">{item.day}</Text>
              <View
                style={[
                  styles.dayCircle,
                  item.done && styles.dayDone,
                  item.missed && styles.dayMissed,
                  item.today && styles.dayToday,
                ]}
              >
                {item.done ? (
                  <Ionicons name="checkmark" size={15} color="#fff" />
                ) : (
                  <Text style={[styles.dayText, item.today && styles.dayTextToday]}>{index + 1}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.callout}>
        <View style={styles.quickIcon}>
          <Ionicons name="flash" size={20} color={colors.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.orangeEyebrow}>Quick fix</Text>
          <Text variant="subtitle">Practice past tense</Text>
          <Text variant="caption">Your top weak point this week</Text>
        </View>
        <Pressable onPress={() => router.push("/lesson/practice")} style={styles.roundLink}>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </Pressable>
      </Card>

      <Card style={styles.callout}>
        <View style={styles.talkIcon}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subtitle">Want to just talk?</Text>
          <Text variant="caption">Talk first. Fix patterns after.</Text>
        </View>
        <Button onPress={() => router.push("/freetalk")} style={styles.smallButton}>
          Free Talk
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow,
  },
  streakText: {
    fontWeight: "800",
  },
  hero: {
    borderRadius: radius.xl,
    padding: 20,
    overflow: "hidden",
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  heroSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
  },
  tags: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    marginTop: 18,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    width: "8%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  heroMeta: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroMetaText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
  },
  heroButton: {
    marginTop: 16,
    backgroundColor: "#fff",
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  link: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  weekRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekItem: {
    alignItems: "center",
    gap: 7,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayMissed: {
    backgroundColor: "#f1f0f7",
  },
  dayToday: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  dayText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  dayTextToday: {
    color: colors.primary,
  },
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeLight,
  },
  talkIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  orangeEyebrow: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  roundLink: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  smallButton: {
    minHeight: 38,
    paddingHorizontal: 14,
  },
});
