import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";
import { patterns } from "@/data/mock";

export default function TalkSummaryScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View>
          <Text variant="eyebrow" style={{ color: colors.primary }}>Talk summary</Text>
          <Text variant="subtitle">Here is what Noona noticed</Text>
        </View>
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroLine}>
          <Ionicons name="sparkles" size={15} color="#fff" />
          <Text style={styles.heroSmall}>Talk first, fix after</Text>
        </View>
        <Text style={styles.heroTitle}>3 patterns from your real words</Text>
        <Text style={styles.heroSub}>
          Noona kept the conversation flowing and saved only the useful fixes.
        </Text>
      </LinearGradient>

      {patterns.map((pattern) => (
        <Card key={pattern.title}>
          <View style={styles.patternTop}>
            <View>
              <Text variant="subtitle">{pattern.title}</Text>
              <Text variant="caption">
                Appeared {pattern.count} {pattern.count === 1 ? "time" : "times"} in this talk
              </Text>
            </View>
            <View style={styles.patternBadge}>
              <Text style={styles.patternBadgeText}>pattern</Text>
            </View>
          </View>
          <View style={styles.fixRow}>
            <Text style={styles.wrong}>{pattern.wrong}</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.muted} />
            <Text style={styles.correct}>{pattern.correct}</Text>
          </View>
        </Card>
      ))}

      <Card>
        <View style={styles.quickTop}>
          <View style={styles.quickIcon}>
            <Ionicons name="flash" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="subtitle">Fix in 3 minutes</Text>
            <Text variant="caption">A quick lesson built from these exact mistakes.</Text>
          </View>
        </View>
        <Button onPress={() => router.push("/lesson/practice")} style={{ marginTop: 14 }}>
          Start quick fix
        </Button>
      </Card>

      <Card style={styles.tomorrow}>
        <Ionicons name="checkmark-circle" size={20} color={colors.green} />
        <View style={{ flex: 1 }}>
          <Text variant="subtitle">Tomorrow's Daily Lesson is ready</Text>
          <Text variant="caption" style={{ marginTop: 4 }}>
            It will focus on agreement phrases and past tense, because those came from your own conversation.
          </Text>
        </View>
      </Card>

      <Button variant="outline" onPress={() => router.push("/")}>
        Back home
      </Button>
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
  hero: {
    borderRadius: 28,
    padding: 20,
  },
  heroLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroSmall: {
    color: "#fff",
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 10,
    color: "#fff",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
  },
  heroSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.82)",
  },
  patternTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  patternBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  patternBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  fixRow: {
    marginTop: 14,
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
  quickTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  tomorrow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.greenLight,
  },
});
