import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MicButton } from "@/components/MicButton";
import { colors } from "@/constants/theme";

export default function RoleplayScreen() {
  return (
    <Screen>
      <Card>
        <Text variant="eyebrow" style={{ color: colors.primary }}>Scenario</Text>
        <Text variant="title" style={{ marginTop: 6 }}>Coffee shop</Text>
        <Text variant="caption" style={{ marginTop: 6 }}>
          Your role: Customer. AI role: Barista. Goal: order a drink and ask about price.
        </Text>
      </Card>

      <View style={styles.chat}>
        <View style={styles.aiBubble}>
          <Text>Hello! What would you like to order today?</Text>
        </View>
        <View style={styles.userBubble}>
          <Text style={{ color: "#fff" }}>Can I have a coffee, please?</Text>
        </View>
        <View style={styles.aiBubble}>
          <Text>Sure. Would you like a small or large one?</Text>
        </View>
      </View>

      <Card style={styles.input}>
        <MicButton />
        <Text style={styles.hold}>Hold to speak</Text>
        <Button variant="outline" onPress={() => router.push("/lesson/result")} style={{ marginTop: 12 }}>
          Finish turn
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chat: {
    gap: 12,
  },
  aiBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    borderRadius: 20,
    borderTopLeftRadius: 6,
    backgroundColor: colors.card,
    padding: 14,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    borderRadius: 20,
    borderTopRightRadius: 6,
    backgroundColor: colors.primary,
    padding: 14,
  },
  input: {
    alignItems: "center",
  },
  hold: {
    marginTop: 10,
    fontWeight: "800",
  },
});
