import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { colors, radius, shadow } from "@/constants/theme";

const scenarios = [
  { title: "Coffee shop", role: "Customer", goal: "Order a drink and ask about the price.", icon: "cafe-outline", prompt: "Hello! Welcome to the coffee shop. What would you like to order?" },
  { title: "Job interview", role: "Candidate", goal: "Introduce yourself and describe your strengths.", icon: "briefcase-outline", prompt: "Thanks for coming today. Could you tell me a little about yourself?" },
  { title: "Hotel check-in", role: "Guest", goal: "Check in and ask about breakfast.", icon: "bed-outline", prompt: "Good evening. Welcome to the hotel. How can I help you?" },
  { title: "At the airport", role: "Passenger", goal: "Find your gate and confirm the boarding time.", icon: "airplane-outline", prompt: "Hello. Where are you flying today?" },
];

export default function RoleplayScreen() {
  const start = (scenario: (typeof scenarios)[number]) => router.push({
    pathname: "/freetalk",
    params: { topic: `${scenario.title} roleplay`, prompt: scenario.prompt },
  });
  const back = () => router.canGoBack() ? router.back() : router.replace("/(tabs)/lessons");

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={back} style={styles.back}><Ionicons name="arrow-back" size={19} color={colors.text} /></Pressable>
        <View><Text variant="title">Roleplay</Text><Text variant="caption">Practice a real conversation.</Text></View>
      </View>
      <View style={styles.list}>
        {scenarios.map((scenario) => (
          <Pressable key={scenario.title} onPress={() => start(scenario)} style={styles.scenario}>
            <View style={styles.icon}><Ionicons name={scenario.icon as any} size={22} color={colors.primary} /></View>
            <View style={styles.copy}>
              <Text variant="subtitle">{scenario.title}</Text>
              <Text variant="caption">You are the {scenario.role}. {scenario.goal}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  list: { gap: 12 },
  scenario: { minHeight: 94, borderRadius: radius.lg, backgroundColor: colors.card, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, ...shadow },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  copy: { flex: 1, minWidth: 0, gap: 4 },
});
