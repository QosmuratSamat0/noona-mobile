import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MicButton } from "@/components/MicButton";
import { CorrectionBadge } from "@/components/CorrectionBadge";
import { colors } from "@/constants/theme";

type Message = {
  id: string;
  role: "ai" | "user";
  text: string;
  correction?: {
    pattern: string;
    better: string;
    why: string;
  };
};

const seed: Message[] = [
  { id: "1", role: "ai", text: "Hey Ayan! What did you do today?" },
  {
    id: "2",
    role: "user",
    text: "I am agree with you, today was good.",
    correction: {
      pattern: "agreement",
      better: "I agree with you.",
      why: "Do not use 'am' with 'agree'.",
    },
  },
  { id: "3", role: "ai", text: "Nice. Tell me about the best part of your day." },
];

export default function FreeTalkScreen() {
  const [messages, setMessages] = useState(seed);
  const [draft, setDraft] = useState("");

  const send = () => {
    const value = draft.trim();
    if (!value) return;
    setMessages((items) => [...items, { id: `u-${Date.now()}`, role: "user", text: value }]);
    setDraft("");
    setTimeout(() => {
      setMessages((items) => [
        ...items,
        { id: `a-${Date.now()}`, role: "ai", text: "Got it - tell me more!" },
      ]);
    }, 500);
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="subtitle">Free Talk</Text>
          <Text variant="caption">Open practice - AI still corrects you</Text>
        </View>
        <Pressable onPress={() => router.push("/freetalk/summary")} style={styles.end}>
          <Text style={styles.endText}>End talk</Text>
          <Ionicons name="flag" size={13} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.chat}>
        <View style={styles.notice}>
          <Text variant="caption">
            Chat naturally. Noona saves repeated patterns quietly and turns them into quick lessons.
          </Text>
        </View>
        {messages.map((message) =>
          message.role === "ai" ? (
            <View key={message.id} style={styles.aiBubble}>
              <Text>{message.text}</Text>
            </View>
          ) : (
            <View key={message.id} style={styles.userWrap}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
              {message.correction && <CorrectionBadge {...message.correction} />}
            </View>
          ),
        )}
      </View>

      <View style={styles.composer}>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            style={styles.input}
            onSubmitEditing={send}
          />
          <Pressable onPress={send} style={styles.send}>
            <Ionicons name="send" size={17} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.voiceRow}>
          <MicButton size={50} />
          <Text variant="caption">or hold to speak</Text>
        </View>
        <Pressable onPress={() => router.push("/freetalk/summary")}>
          <Text style={styles.finish}>Finish and see patterns</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f0f7",
  },
  end: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  endText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  chat: {
    flex: 1,
    gap: 12,
    padding: 16,
  },
  notice: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: colors.card,
    padding: 12,
  },
  aiBubble: {
    maxWidth: "82%",
    alignSelf: "flex-start",
    borderRadius: 20,
    borderTopLeftRadius: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userWrap: {
    maxWidth: "86%",
    alignSelf: "flex-end",
    gap: 6,
  },
  userBubble: {
    borderRadius: 20,
    borderTopRightRadius: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userText: {
    color: "#fff",
  },
  composer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#faf9ff",
    paddingHorizontal: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  finish: {
    textAlign: "center",
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
});
