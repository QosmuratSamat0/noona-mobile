import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";

const modes = [
  {
    title: "Classic",
    desc: "Guided practice with simple prompts.",
    icon: "book-outline" as const,
    color: colors.primaryLight,
    iconColor: colors.primary,
    to: "/lesson/session",
    recommended: true,
  },
  {
    title: "Role-play",
    desc: "Coffee shop, airport, interview...",
    icon: "people-outline" as const,
    color: colors.yellow,
    iconColor: "#b45309",
    to: "/roleplay",
  },
  {
    title: "Unexpected Case",
    desc: "Sudden situations. React fast.",
    icon: "flash-outline" as const,
    color: colors.redLight,
    iconColor: "#dc2626",
    to: "/lesson/session",
  },
  {
    title: "Free Talk",
    desc: "Talk first. Fix patterns after.",
    icon: "chatbubble-ellipses-outline" as const,
    color: colors.greenLight,
    iconColor: "#15803d",
    to: "/freetalk",
  },
];

export default function LessonStartScreen() {
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/lessons");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Choose a mode</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text variant="caption">How do you want to practice today?</Text>

      <View style={styles.list}>
        {modes.map((mode) => (
          <Pressable key={mode.title} onPress={() => router.push(mode.to as never)}>
            <Card style={styles.mode}>
              <View style={[styles.modeIcon, { backgroundColor: mode.color }]}>
                <Ionicons name={mode.icon} size={22} color={mode.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.modeTitleRow}>
                  <Text variant="subtitle">{mode.title}</Text>
                  {mode.recommended && (
                    <View style={styles.recommended}>
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text variant="caption">{mode.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  list: {
    gap: 12,
  },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  modeIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recommended: {
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
