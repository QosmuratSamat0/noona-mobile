import { useState, useEffect, useRef } from "react";
import { Pressable, StyleSheet, TextInput, View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MicButton } from "@/components/MicButton";
import { changedPhrase, CorrectionDetail, CorrectionSheet } from "@/components/CorrectionBadge";
import { colors } from "@/constants/theme";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudio } from "@/hooks/useAudio";
import { api } from "@/utils/api";
import { Audio } from "expo-av";

type Message = {
  id: string;
  role: "ai" | "user";
  text: string;
  correction?: {
    pattern: string;
    original: string;
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
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionDetail | null>(null);

  const { messages: wsMessages } = useWebSocket();
  const { isRecording, startRecording, stopRecording, playAudio } = useAudio();
  const flatListRef = useRef<FlatList>(null);
  const talkStartedAtRef = useRef<string>(new Date().toISOString());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await api.post("/sessions");
        setSessionID(res.data.id);
        
        // Add greeting message
        setMessages([
          { id: "greeting", role: "ai", text: "Hey! What did you do today?" }
        ]);

        // Pre-request microphone permission to avoid browser gesture blocks/lag later
        await Audio.requestPermissionsAsync().catch(() => {});
      } catch (err) {
        console.error("Failed to create chat session or request permissions", err);
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
        isAtBottomRef.current = true;
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
              original: quickFeedback.data.original || m.text,
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
        isAtBottomRef.current = true;
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
    isAtBottomRef.current = true;
    setMessages(items => [...items, { id: tempId, role: "user", text: value }]);
    setDraft("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

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
              original: feedback.original || value,
              better: feedback.corrected_text,
              why: feedback.reason
            } : undefined
          };
        }
        return m;
      }));

      setMessages(items => {
        isAtBottomRef.current = true;
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        return [...items, { id, role: "ai", text: content }];
      });

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
    if (!uri || !sessionID) {
      console.log('handleStopRecording: no uri or sessionID', { uri: !!uri, sessionID: !!sessionID });
      return;
    }

    try {
      const formData = new FormData();
      
      let fileToUpload: any;
      if (Platform.OS === 'web') {
        const fetchResponse = await fetch(uri);
        const blob = await fetchResponse.blob();
        const mimeType = blob.type || 'audio/webm';
        fileToUpload = new File([blob], 'audio.webm', { type: mimeType });
        console.log('Audio file prepared for upload:', { size: blob.size, type: mimeType });
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
      
      console.log('Audio uploaded, job_id:', response.data.job_id);
      setCurrentJobId(response.data.job_id);
    } catch (err) {
      console.error("Audio upload failed", err);
    }
  };


  const handleCancelRecording = async () => {
    await stopRecording();
  };

  const handleEndTalk = () => {
    if (!sessionID) {
      router.push("/freetalk/summary");
      return;
    }

    const corrections = messages
      .filter((message) => message.role === "user" && message.correction)
      .map((message) => ({
        id: message.id,
        original: message.correction?.original || message.text,
        corrected: message.correction?.better || message.text,
        reason: message.correction?.why || "",
        pattern: message.correction?.pattern || "grammar",
      }));

    const payload = JSON.stringify(corrections);

    if (Platform.OS === "web") {
      try {
        localStorage.setItem(`freetalk-summary:${sessionID}`, payload);
      } catch (error) {
        console.warn("Failed to cache talk summary", error);
      }
    }

    router.push({
      pathname: "/freetalk/summary",
      params: {
        session_id: sessionID,
        started_at: talkStartedAtRef.current,
        corrections: payload,
      },
    });
  };


  const renderCorrectableText = (message: Message) => {
    if (!message.correction) {
      return <Text style={styles.userText}>{message.text}</Text>;
    }

    const changed = changedPhrase(message.correction.original || message.text, message.correction.better);
    const phrase = changed.wrong;
    const index = phrase ? message.text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
    if (index < 0) {
      return <Text style={styles.userText}>{message.text}</Text>;
    }

    const before = message.text.slice(0, index);
    const match = message.text.slice(index, index + phrase.length);
    const after = message.text.slice(index + phrase.length);

    return (
      <Text style={styles.userText}>
        {before}
        <Text
          style={styles.inlineError}
          onPress={() => setSelectedCorrection(message.correction || null)}
        >
          {match}
        </Text>
        {after}
      </Text>
    );
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
          {renderCorrectableText(message)}
        </View>
      </View>
    );
  };

  const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardWrapper 
        style={{ flex: 1, overflow: 'hidden' }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            }} 
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text variant="subtitle" numberOfLines={1}>Free Talk</Text>
            <Text variant="caption" numberOfLines={1}>Open practice - AI still corrects you</Text>
          </View>
          <Pressable onPress={handleEndTalk} style={styles.end}>
            <Text style={styles.endText}>End talk</Text>
            <Ionicons name="flag" size={13} color="#fff" />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chat}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              // Add a small threshold (30px) to consider "at bottom"
              const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 30;
              isAtBottomRef.current = isBottom;
              setShowScrollButton(!isBottom);
            }}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (isAtBottomRef.current) {
                flatListRef.current?.scrollToEnd({ animated: true });
              }
            }}
            renderItem={renderMessage}
          />
          {showScrollButton && (
            <Pressable 
              style={styles.scrollBtn}
              onPress={() => {
                isAtBottomRef.current = true;
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
            >
              <Ionicons name="chevron-down" size={24} color="#fff" />
            </Pressable>
          )}
        </View>

        {!selectedCorrection && <View style={styles.composer}>
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
              
              <View style={styles.voiceCenter}>
                <MicButton 
                  size={50} 
                  onStart={handleStartRecording} 
                  onStop={handleStopRecording} 
                  onCancel={handleCancelRecording}
                  disabled={!sessionID}
                />
                {!isRecording ? (
                  <Text variant="caption">
                    or hold to speak
                  </Text>
                ) : (
                  <View style={{ height: 16 }} />
                )}
              </View>

              {!isRecording && (
                <Pressable onPress={() => setInputType("text")} style={styles.toggleBtn}>
                  <Ionicons name="keypad-outline" size={22} color={colors.primary} />
                </Pressable>
              )}
            </View>
          )}
        </View>}

        <CorrectionSheet
          correction={selectedCorrection}
          visible={Boolean(selectedCorrection)}
          onClose={() => setSelectedCorrection(null)}
        />
      </KeyboardWrapper>
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
  headerTitle: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
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
  scrollBtn: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 10,
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
  inlineError: {
    color: "#dbeafe",
    backgroundColor: "rgba(219,234,254,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    borderRadius: 6,
    fontWeight: "900",
    textDecorationLine: "none",
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
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
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
