import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { ChatMessage, Correction } from '../entities/chat/model';
import { initialMessages } from '../entities/chat/model';
import { uploadAudio } from '../features/audio/api';
import { createSession, getSessionMessages, getSessions, sendMessage } from '../features/chat/api';
import { makeWsUrl } from '../shared/api/ws';
import { getErrorMessage } from '../shared/lib/errors';
import { colors } from '../shared/theme/colors';
import { CorrectionCard, PlayRow } from '../shared/ui/ChatWidgets';
import { styles } from '../shared/ui/styles';

export function ChatScreen({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'processing'>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const appendCorrection = useCallback((correction: Correction) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: correction.transcript || 'Audio uploaded',
        correction:
          correction.corrected && correction.corrected !== correction.transcript
            ? {
                from: correction.transcript,
                to: correction.corrected,
                note: correction.explanation || 'Suggested correction',
              }
            : undefined,
      },
    ]);
  }, []);

  useEffect(() => {
    let active = true;
    const bootSession = async () => {
      try {
        const sessions = await getSessions(token);
        const session = (Array.isArray(sessions) ? sessions[0] : undefined) ?? (await createSession(token));
        if (!active) return;
        setSessionId(session.id);
        const history = await getSessionMessages(session.id, token);
        if (!active || !Array.isArray(history) || history.length === 0) return;
        setMessages(
          history.map((message) => ({
            id: message.id,
            role: message.role === 'user' ? 'user' : 'coach',
            text: message.content,
          })),
        );
      } catch {
        if (active) setMessages(initialMessages);
      }
    };
    void bootSession();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const ws = new WebSocket(makeWsUrl(token));
    ws.onmessage = (event) => {
      String(event.data)
        .split('\n')
        .filter(Boolean)
        .forEach((raw) => {
          try {
            const payload = JSON.parse(raw);
            if (!payload.type && payload.data?.text) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === 'coach-stream') {
                  return [...prev.slice(0, -1), { ...last, text: `${last.text}${payload.data.text}` }];
                }
                return [...prev, { id: 'coach-stream', role: 'coach', text: payload.data.text }];
              });
              return;
            }
            if (payload.data?.is_final) {
              setStatus('idle');
              return;
            }
            if (payload.type !== 'audio_processing_result') return;
            const data = payload.data ?? {};
            const analysis = data.analysis ?? {};
            appendCorrection({
              transcript: data.transcript ?? '',
              corrected: analysis.correction,
              explanation: analysis.explanation,
              audioUrl: data.audio_url,
            });
            setStatus('idle');
          } catch {
            setStatus('idle');
          }
        });
    };
    ws.onerror = () => setStatus('idle');
    return () => ws.close();
  }, [appendCorrection, token]);

  const submitText = async () => {
    const text = draft.trim();
    if (!text || !sessionId || status !== 'idle') return;
    const localMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, localMessage]);
    setDraft('');
    try {
      const saved = await sendMessage(sessionId, text, token);
      setMessages((prev) => prev.map((message) => (message.id === localMessage.id ? { ...message, id: saved.id } : message)));
    } catch (error) {
      Alert.alert('Message failed', getErrorMessage(error));
    }
  };

  const startRecording = async () => {
    if (status !== 'idle') return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to practice speaking.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setStatus('recording');
    } catch (error) {
      setStatus('idle');
      Alert.alert('Recording failed', getErrorMessage(error));
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording || status !== 'recording') return;
    setStatus('uploading');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording file created.');
      await uploadAudio(uri, token, sessionId);
      setStatus('processing');
    } catch (error) {
      setStatus('idle');
      Alert.alert('Upload failed', getErrorMessage(error));
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.chatHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>AI Coach</Text>
          <Text style={styles.online}>Online</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Session 12</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <View key={message.id} style={styles.messageBlock}>
            <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.coachBubble]}>
              <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>{message.text}</Text>
            </View>
            {message.role === 'coach' && <PlayRow />}
            {message.correction && <CorrectionCard correction={message.correction} />}
          </View>
        ))}
        {status === 'processing' && (
          <View style={styles.processingRow}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.subText}>Analyzing your speech...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.speakerBar}>
        <View style={styles.flex}>
          <View style={styles.composerRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              style={styles.composerInput}
              returnKeyType="send"
              onSubmitEditing={submitText}
            />
            <Pressable style={[styles.sendButton, !draft.trim() && styles.disabled]} onPress={submitText} disabled={!draft.trim()}>
              <Ionicons name="send" size={18} color={colors.white} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable
          style={[styles.micButton, status === 'recording' && styles.recordingButton]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={status === 'uploading' || status === 'processing'}
        >
          <Ionicons name={status === 'recording' ? 'stop' : 'mic-outline'} size={26} color={colors.white} />
        </Pressable>
        <View>
          <Text style={styles.speakerTitleDark}>{status === 'recording' ? 'Listening...' : 'Hold to speak'}</Text>
          <Text style={styles.speakerSub}>
            {status === 'uploading' ? 'Uploading audio' : status === 'processing' ? 'Waiting for coach' : 'Release when done'}
          </Text>
        </View>
          </View>
        </View>
      </View>
    </View>
  );
}
