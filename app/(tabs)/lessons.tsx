import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors, radius, shadow } from "@/constants/theme";

const modes = [
  {
    title: "Quick Fix",
    desc: "Train one mistake from your summary.",
    meta: "3-5 min",
    icon: "flash-outline",
    color: colors.orange,
    bg: colors.orangeLight,
    to: "/lesson/practice",
    enabled: true,
  },
  {
    title: "Guided Lesson",
    desc: "Short prompts with focused feedback.",
    meta: "Classic",
    icon: "book-outline",
    color: colors.primaryDark,
    bg: colors.primaryLight,
    to: "/lesson/session",
    enabled: true,
  },
  {
    title: "Roleplay",
    desc: "Practice real situations with AI.",
    meta: "Scenario",
    icon: "people-outline",
    color: colors.green,
    bg: colors.greenLight,
    to: "/roleplay",
    enabled: true,
  },
  {
    title: "Pronunciation",
    desc: "Say it clearly and compare.",
    meta: "Coming soon",
    icon: "mic-outline",
    color: "#0f766e",
    bg: "#e6fffb",
    to: "/lesson/session",
    enabled: false,
  },
  {
    title: "Vocabulary Drill",
    desc: "Use better words in short answers.",
    meta: "Coming soon",
    icon: "sparkles-outline",
    color: "#7c3aed",
    bg: "#f3e8ff",
    to: "/lesson/session",
    enabled: false,
  },
];

export default function LessonsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="title">Practice modes</Text>
          <Text variant="caption">Choose what you want to do now.</Text>
        </View>
      </View>

      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.featured}>
        <View style={styles.featuredGlow} />
        <View style={styles.featuredContent}>
          <View style={styles.featuredTop}>
            <View style={styles.featuredIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
            </View>
            <Text style={styles.featuredKicker}>Recommended mode</Text>
          </View>
          <Text style={styles.featuredTitle}>Start with Free Talk</Text>
          <Text style={styles.featuredText}>
            No finish button. Corrections are saved automatically into Progress.
          </Text>
          <View style={styles.featuredBottom}>
            <View style={styles.featuredMiniStat}>
              <Text style={styles.featuredMiniValue}>Open</Text>
              <Text style={styles.featuredMiniLabel}>practice</Text>
            </View>
            <Pressable onPress={() => router.push("/freetalk")} style={styles.featuredButton}>
              <Text style={styles.featuredButtonText}>Open</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.modeSection}>
        <View style={styles.sectionRow}>
          <Text variant="subtitle">All actions</Text>
          <Text variant="caption">Pick a mode</Text>
        </View>
        {modes.map((mode) => (
          <Pressable
            key={mode.title}
            onPress={() => mode.enabled && router.push(mode.to as never)}
            disabled={!mode.enabled}
          >
            <Card style={[styles.modeRow, !mode.enabled && styles.modeDisabled]}>
              <View style={styles.modeMain}>
                <View style={[styles.modeIcon, { backgroundColor: mode.bg }]}>
                  <Ionicons name={mode.icon as any} size={21} color={mode.color} />
                </View>
                <View style={styles.modeCopy}>
                  <View style={styles.modeTitleLine}>
                    <Text variant="subtitle" numberOfLines={1}>{mode.title}</Text>
                    <Text style={[styles.modeMeta, { color: mode.color }]} numberOfLines={1}>
                      {mode.meta}
                    </Text>
                  </View>
                  <Text variant="caption" numberOfLines={1}>{mode.desc}</Text>
                </View>
              </View>
              <View style={[styles.arrow, !mode.enabled && styles.arrowDisabled]}>
                <Ionicons name={mode.enabled ? "chevron-forward" : "lock-closed-outline"} size={17} color={mode.enabled ? colors.primary : colors.muted} />
              </View>
            </Card>
          </Pressable>
        ))}
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
  featured: {
    borderRadius: radius.xl,
    minHeight: 214,
    overflow: "hidden",
    position: "relative",
  },
  featuredGlow: {
    position: "absolute",
    right: -34,
    top: -34,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  featuredContent: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  featuredTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featuredIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  featuredKicker: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  featuredTitle: {
    marginTop: 14,
    color: "#fff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  featuredText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  featuredBottom: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  featuredMiniStat: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featuredMiniValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  featuredMiniLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  featuredButton: {
    minHeight: 42,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
  },
  featuredButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  modeSection: {
    gap: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeRow: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modeDisabled: {
    opacity: 0.78,
  },
  modeMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modeIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  modeTitleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  modeMeta: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    ...shadow,
  },
  arrowDisabled: {
    backgroundColor: "#f1f0f7",
    shadowOpacity: 0,
    elevation: 0,
  },
});
