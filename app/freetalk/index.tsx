import { useState, useEffect, useRef } from "react";
import { Pressable, StyleSheet, TextInput, View, FlatList, KeyboardAvoidingView, Platform, Modal, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MicButton } from "@/components/MicButton";
import { CorrectionDetail, CorrectionSheet } from "@/components/CorrectionBadge";
import { NoonaAvatar } from "@/components/noona";
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

type PersistedMessage = {
  id: string;
  role: "ai" | "user";
  content: string;
  feedback?: {
    original?: string;
    corrected_text?: string;
    reason?: string;
  };
};

const greetingMessage: Message = { id: "greeting", role: "ai", text: "Hey! What did you do today?" };

const talkTopics = [
  { title: "Travel", prompt: "Let's talk about travel. What place do you want to visit next, and why?" },
  { title: "Food", prompt: "Let's talk about food. What dish could you eat again and again?" },
  { title: "Work", prompt: "Let's talk about work. What kind of work feels interesting to you?" },
  { title: "Movies", prompt: "Let's talk about movies. What movie stayed in your mind recently?" },
  { title: "Music", prompt: "Let's talk about music. What song matches your mood today?" },
  { title: "Technology", prompt: "Let's talk about technology. What app or device do you use every day?" },
  { title: "Family", prompt: "Let's talk about family. Who gives you good advice?" },
  { title: "Friends", prompt: "Let's talk about friends. What makes someone a good friend?" },
  { title: "Health", prompt: "Let's talk about health. What habit helps you feel better?" },
  { title: "Sports", prompt: "Let's talk about sports. What sport do you like watching or playing?" },
  { title: "Books", prompt: "Let's talk about books. What story or idea changed how you think?" },
  { title: "Business", prompt: "Let's talk about business. What small business idea sounds exciting?" },
  { title: "Education", prompt: "Let's talk about education. What skill do you want to learn faster?" },
  { title: "Dreams", prompt: "Let's talk about dreams. What future goal feels important to you?" },
  { title: "Culture", prompt: "Let's talk about culture. What tradition do you like?" },
  { title: "Daily life", prompt: "Let's talk about daily life. What part of your day do you enjoy most?" },
  { title: "Money", prompt: "Let's talk about money. What do you think is worth spending money on?" },
  { title: "Nature", prompt: "Let's talk about nature. What kind of weather makes you feel good?" },
];

const mapPersistedMessage = (message: PersistedMessage): Message => ({
  id: message.id,
  role: message.role,
  text: message.content,
  correction: message.feedback?.original && message.feedback?.corrected_text && message.feedback.corrected_text !== message.feedback.original
    ? {
        pattern: "grammar",
        original: message.feedback.original,
        better: message.feedback.corrected_text,
        why: message.feedback.reason || "Use the better version in your next answer.",
      }
    : undefined,
});

export default function FreeTalkScreen() {
  const params = useLocalSearchParams<{ topic?: string; prompt?: string }>();
  const initialTopic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const initialPrompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [playedJobs, setPlayedJobs] = useState<Set<string>>(new Set());
  const [inputType, setInputType] = useState<"voice" | "text">("voice");
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionDetail | null>(null);
  const [topicSheetOpen, setTopicSheetOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(initialTopic || null);

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
        const nextSessionID = res.data.id;
        setSessionID(nextSessionID);

        const history = await api.get(`/sessions/${nextSessionID}/messages`);
        const savedMessages = Array.isArray(history.data) ? history.data.map(mapPersistedMessage) : [];
        const greeting = initialPrompt
          ? { id: "greeting", role: "ai" as const, text: initialPrompt }
          : greetingMessage;
        setMessages(initialPrompt ? [...savedMessages, greeting] : savedMessages.length ? savedMessages : [greeting]);

        // Pre-request microphone permission to avoid browser gesture blocks/lag later
        await Audio.requestPermissionsAsync().catch(() => {});
      } catch (err) {
        console.error("Failed to create chat session or request permissions", err);
      }
    };
    initSession();
  }, [initialPrompt]);

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
      const res = await api.post(`/sessions/${sessionID}/messages`, {
        content: value,
        selected_topic: selectedTopic || "",
      });
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
      formData.append('selected_topic', selectedTopic || '');

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

  const chooseTopic = (topic: (typeof talkTopics)[number]) => {
    setSelectedTopic(topic.title);
    setTopicSheetOpen(false);
    isAtBottomRef.current = true;
    setMessages((items) => [
      ...items,
      {
        id: `topic-${Date.now()}`,
        role: "ai",
        text: topic.prompt,
      },
    ]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
    return <Text style={styles.userText}>{message.text}</Text>;
  };

  const renderMessage = ({ item: message }: { item: Message }) => {
    if (message.role === "ai") {
      return (
        <View style={styles.aiRow}>
          <NoonaAvatar size="sm" mood="happy" style={styles.aiAvatar} />
          <View style={styles.aiBubble}>
            <Text>{message.text}</Text>
          </View>
        </View>
      );
    }
    const hasCorrection = Boolean(message.correction);
    return (
      <View style={styles.userWrap}>
        <Pressable
          disabled={!hasCorrection}
          onPress={() => setSelectedCorrection(message.correction || null)}
          style={[styles.userBubble, hasCorrection && styles.userBubbleCorrectable]}
        >
          {renderCorrectableText(message)}
        </Pressable>
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
          {selectedTopic && (
            <View style={styles.topicBar}>
              <Ionicons name="chatbubbles-outline" size={15} color={colors.primary} />
              <Text style={styles.topicBarText} numberOfLines={1}>{selectedTopic}</Text>
              <Pressable onPress={() => setSelectedTopic(null)} style={styles.topicClear}>
                <Ionicons name="close" size={14} color={colors.muted} />
              </Pressable>
            </View>
          )}
          {inputType === "text" ? (
            <View style={styles.inputRow}>
              <Pressable onPress={() => setTopicSheetOpen(true)} style={styles.topicBtn}>
                <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
              </Pressable>
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
              {!isRecording ? (
                <Pressable onPress={() => setTopicSheetOpen(true)} style={styles.topicBtnWide}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                  <Text style={styles.topicBtnText}>Choose topic</Text>
                </Pressable>
              ) : (
                <View style={{ width: 118 }} />
              )}
              
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

        <Modal
          visible={topicSheetOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setTopicSheetOpen(false)}
        >
          <Pressable style={styles.topicOverlay} onPress={() => setTopicSheetOpen(false)}>
            <Pressable style={styles.topicSheet}>
              <View style={styles.topicSheetHeader}>
                <View>
                  <Text variant="subtitle">Choose topic</Text>
                  <Text variant="caption">Pick one and start speaking.</Text>
                </View>
                <Pressable onPress={() => setTopicSheetOpen(false)} style={styles.topicClose}>
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.topicGrid}>
                {talkTopics.map((topic) => (
                  <Pressable
                    key={topic.title}
                    onPress={() => chooseTopic(topic)}
                    style={[styles.topicOption, selectedTopic === topic.title && styles.topicOptionActive]}
                  >
                    <Text style={[styles.topicOptionText, selectedTopic === topic.title && styles.topicOptionTextActive]}>
                      {topic.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
  aiRow: {
    maxWidth: "88%",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  aiAvatar: {
    marginBottom: 1,
  },
  userBubbleCorrectable: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
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
  topicBar: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
    paddingLeft: 11,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topicBarText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  topicClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
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
  topicBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f0f7",
  },
  topicBtnWide: {
    width: 118,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f1f0f7",
  },
  topicBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  topicOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.28)",
  },
  topicSheet: {
    maxHeight: "72%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  topicSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  topicClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f0f7",
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 10,
  },
  topicOption: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf9ff",
  },
  topicOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  topicOptionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  topicOptionTextActive: {
    color: colors.primary,
  },
  finish: {
    textAlign: "center",
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
});
