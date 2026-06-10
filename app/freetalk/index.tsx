import { useState, useEffect, useRef } from "react";
import { Pressable, StyleSheet, TextInput, View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MicButton } from "@/components/MicButton";
import { CorrectionBadge } from "@/components/CorrectionBadge";
import { colors } from "@/constants/theme";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudio } from "@/hooks/useAudio";
import { api } from "@/utils/api";

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

export default function FreeTalkScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [playedJobs, setPlayedJobs] = useState<Set<string>>(new Set());
  const [inputType, setInputType] = useState<"voice" | "text">("voice");

  const { messages: wsMessages } = useWebSocket();
  const { isRecording, startRecording, stopRecording, playAudio } = useAudio();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await api.post("/sessions");
        setSessionID(res.data.id);
        
        // Add greeting message
        setMessages([
          { id: "greeting", role: "ai", text: "Hey! What did you do today?" }
        ]);
      } catch (err) {
        console.error("Failed to create chat session", err);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    if (!currentJobId) return;

    const jobMsgs = wsMessages.filter(m => m.data?.job_id === currentJobId);
    
    // User Message from Audio
    const transcript = jobMsgs.find(m => m.type === "transcript_final");
    if (transcript) {
      setMessages(prev => {
        if (prev.find(m => m.id === currentJobId)) return prev;
        return [...prev, { id: currentJobId, role: "user", text: transcript.data.text }];
      });
    }

    // Feedback
    const quickFeedback = jobMsgs.find(m => m.type === "quick_feedback");
    if (quickFeedback && quickFeedback.data.corrected_text !== quickFeedback.data.original) {
      setMessages(prev => prev.map(m => {
        if (m.id === currentJobId) {
          return {
            ...m,
            correction: {
              pattern: "grammar",
              better: quickFeedback.data.corrected_text,
              why: quickFeedback.data.reason
            }
          };
        }
        return m;
      }));
    }

    // AI Reply
    const coachReply = jobMsgs.find(m => m.type === "coach_reply");
    if (coachReply) {
      const aiId = `ai-${currentJobId}`;
      setMessages(prev => {
        if (prev.find(m => m.id === aiId)) return prev;
        return [...prev, { id: aiId, role: "ai", text: coachReply.data.text }];
      });
    }

    // Play Audio
    const ttsReady = jobMsgs.find(m => m.type === "tts_ready");
    if (ttsReady && ttsReady.data.audio_url && !playedJobs.has(currentJobId)) {
      setPlayedJobs(prev => new Set(prev).add(currentJobId));
      playAudio(ttsReady.data.audio_url);
    }
  }, [wsMessages, currentJobId, playedJobs, playAudio]);

  const sendText = async () => {
    const value = draft.trim();
    if (!value || !sessionID) return;

    const tempId = `temp-${Date.now()}`;
    setMessages(items => [...items, { id: tempId, role: "user", text: value }]);
    setDraft("");

    try {
      const res = await api.post(`/sessions/${sessionID}/messages`, { content: value });
      const { id, content, feedback, audio_url } = res.data;
      
      setMessages(prev => prev.map(m => {
        if (m.id === tempId) {
          return {
            ...m,
            id: id + "-user",
            correction: feedback && feedback.corrected_text !== feedback.original ? {
              pattern: "grammar",
              better: feedback.corrected_text,
              why: feedback.reason
            } : undefined
          };
        }
        return m;
      }));

      setMessages(items => [...items, { id, role: "ai", text: content }]);

      if (audio_url) {
        playAudio(audio_url);
      }
    } catch (err) {
      console.error("Failed to send text message", err);
    }
  };

  const handleStartRecording = async () => {
    setCurrentJobId(null);
    await startRecording();
  };

  const handleStopRecording = async () => {
    const uri = await stopRecording();
    if (!uri || !sessionID) return;

    try {
      const formData = new FormData();
      
      let fileToUpload: any;
      if (Platform.OS === 'web') {
        const fetchResponse = await fetch(uri);
        const blob = await fetchResponse.blob();
        fileToUpload = new File([blob], 'audio.webm', { type: blob.type });
      } else {
        fileToUpload = {
          uri,
          name: 'audio.m4a',
          type: 'audio/m4a'
        };
      }
      
      formData.append('file', fileToUpload);
      formData.append('session_id', sessionID);

      const response = await api.post('/audio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setCurrentJobId(response.data.job_id);
    } catch (err) {
      console.error("Audio upload failed", err);
    }
  };

  const handleCancelRecording = async () => {
    await stopRecording();
  };


  const renderMessage = ({ item: message }: { item: Message }) => {
    if (message.role === "ai") {
      return (
        <View style={styles.aiBubble}>
          <Text>{message.text}</Text>
        </View>
      );
    }
    return (
      <View style={styles.userWrap}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
        {message.correction && <CorrectionBadge {...message.correction} />}
      </View>
    );
  };

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chat}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View style={styles.notice}>
              <Text variant="caption">
                Chat naturally. Noona saves repeated patterns quietly and turns them into quick lessons.
              </Text>
            </View>
          }
          renderItem={renderMessage}
        />

        <View style={styles.composer}>
          {inputType === "text" ? (
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type a message..."
                style={styles.input}
                onSubmitEditing={sendText}
                autoFocus
              />
              <Pressable onPress={() => setInputType("voice")} style={styles.toggleBtn}>
                <Ionicons name="mic-outline" size={22} color={colors.primary} />
              </Pressable>
              <Pressable 
                onPress={sendText} 
                style={[styles.send, !draft.trim() && { opacity: 0.5 }]}
                disabled={!draft.trim()}
              >
                <Ionicons name="send" size={17} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.voiceRow}>
              {/* Balances the switch button on the right */}
              {!isRecording && <View style={{ width: 44 }} />}
              
              <View style={[styles.voiceCenter, isRecording && { justifyContent: "flex-end", paddingRight: 8 }]}>
                <MicButton 
                  size={50} 
                  onStart={handleStartRecording} 
                  onStop={handleStopRecording} 
                  onCancel={handleCancelRecording}
                />
                {!isRecording && (
                  <Text variant="caption">
                    or hold to speak
                  </Text>
                )}
              </View>

              {!isRecording && (
                <Pressable onPress={() => setInputType("text")} style={styles.toggleBtn}>
                  <Ionicons name="keypad-outline" size={22} color={colors.primary} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  notice: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    backgroundColor: colors.card,
    padding: 12,
    marginBottom: 10,
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
    paddingBottom: 24,
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
    justifyContent: "space-between",
  },
  voiceCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  toggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f0f7",
  },
  finish: {
    textAlign: "center",
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
});
