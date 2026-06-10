import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MicButton } from "@/components/MicButton";
import { colors } from "@/constants/theme";

export default function LessonSessionScreen() {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [processing, setProcessing] = useState(false);

  const submit = () => {
    setProcessing(true);
    setTimeout(() => router.push("/lesson/result"), 700);
  };

  return (
    <Screen scroll={false}>
      <View style={styles.top}>
        <Pressable onPress={() => router.push("/")} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Classic</Text>
        </View>
        <Text variant="caption">2 of 3</Text>
      </View>
      <View style={styles.progress}>
        <View style={styles.progressFill} />
      </View>

      <View style={styles.content}>
        <View>
          <Text variant="eyebrow">Lesson</Text>
          <Text variant="title">Past Perfect Tense</Text>
        </View>

        <Card>
          <Text variant="eyebrow" style={{ color: colors.primary }}>Your prompt</Text>
          <Text style={styles.prompt}>Tell me what you did yesterday before dinner.</Text>
        </Card>

        {processing && (
          <Card style={styles.processing}>
            <View style={styles.dot} />
            <Text>Saved. Checking your English...</Text>
          </Card>
        )}
      </View>

      <View style={styles.inputArea}>
        {typing ? (
          <View style={styles.typeBox}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your answer..."
              multiline
              style={styles.textInput}
            />
            <View style={styles.typeActions}>
              <Button variant="outline" onPress={() => setTyping(false)} style={{ flex: 0.35 }}>
                Voice
              </Button>
              <Button onPress={submit} style={{ flex: 1 }}>
                Check my English
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.voiceBox}>
            <Text variant="caption">Hold the button and speak clearly</Text>
            <MicButton onStop={submit} />
            <Text style={styles.hold}>Hold to speak</Text>
            <Pressable onPress={() => setTyping(true)} style={styles.typeInstead}>
              <Ionicons name="keypad-outline" size={14} color={colors.primary} />
              <Text style={styles.typeInsteadText}>Type instead</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
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
  progress: {
    marginTop: 10,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressFill: {
    width: "66%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    gap: 16,
    paddingTop: 18,
  },
  prompt: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  processing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  inputArea: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  voiceBox: {
    alignItems: "center",
    gap: 12,
  },
  hold: {
    fontSize: 15,
    fontWeight: "800",
  },
  typeInstead: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typeInsteadText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  typeBox: {
    gap: 12,
  },
  textInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#faf9ff",
    textAlignVertical: "top",
  },
  typeActions: {
    flexDirection: "row",
    gap: 10,
  },
});
