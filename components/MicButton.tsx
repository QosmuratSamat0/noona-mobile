import { useRef, useState, useEffect } from "react";
import { Animated, Platform, StyleSheet, View, Text, PanResponder } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "@/constants/theme";

export function MicButton({ 
  size = 96, 
  onStart, 
  onStop, 
  onCancel,
  disabled = false
}: { 
  size?: number; 
  onStart?: () => void; 
  onStop?: () => void; 
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const pulse = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Track if we cancelled during the current drag session
  const hasCancelled = useRef(false);

  const disabledRef = useRef(disabled);
  const callbacksRef = useRef({ onStart, onStop, onCancel });

  useEffect(() => {
    disabledRef.current = disabled;
    callbacksRef.current = { onStart, onStop, onCancel };
  }, [disabled, onStart, onStop, onCancel]);

  useEffect(() => {
    if (recording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.2, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        ])
      ).start();
    } else {
      dotOpacity.setValue(1);
    }
  }, [recording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  const start = () => {
    hasCancelled.current = false;
    setRecording(true);
    setDuration(0);
    panX.setValue(0);
    
    callbacksRef.current.onStart?.();
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40); // 40ms light vibration for web
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ).start();

    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const stop = (shouldSave = true) => {
    setRecording(false);
    pulse.stopAnimation();
    pulse.setValue(1);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    Animated.spring(panX, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      friction: 6,
      tension: 40,
    }).start();

    if (shouldSave) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      callbacksRef.current.onStop?.();
    } else {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 50, 50]); // warning vibration pattern
      }
      callbacksRef.current.onCancel?.();
    }
  };

  const CANCEL_THRESHOLD = -100;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      
      onPanResponderGrant: () => {
        if (disabledRef.current) return;

        // Unlock AudioContext on Web
        if (Platform.OS === 'web') {
          try {
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const tempCtx = new AudioContextClass();
              if (tempCtx.state === 'suspended') {
                tempCtx.resume().catch(() => {});
              }
            }
          } catch (e) {}
        }

        start();
      },
      
      onPanResponderMove: (evt, gestureState) => {
        if (hasCancelled.current || disabledRef.current) return;
        
        // Only allow dragging left
        const dx = Math.min(0, gestureState.dx);
        panX.setValue(dx);

        if (dx <= CANCEL_THRESHOLD) {
          hasCancelled.current = true;
          stop(false);
        }
      },
      
      onPanResponderRelease: () => {
        if (disabledRef.current) return;
        if (!hasCancelled.current) {
          stop(true);
        }
      },
      
      onPanResponderTerminate: () => {
        if (disabledRef.current) return;
        if (!hasCancelled.current) {
          stop(false);
        }
      }
    })
  ).current;

  const textOpacity = panX.interpolate({
    inputRange: [CANCEL_THRESHOLD, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {recording && (
        <Animated.View style={[styles.slideOverlay, { opacity: textOpacity }]}>
          <View style={styles.recordIndicator}>
            <Animated.View style={[styles.redDot, { opacity: dotOpacity }]} />
            <Text style={styles.timerText}>{formatTime(duration)}</Text>
          </View>
          <Text style={styles.slideText}>← Slide to cancel</Text>
        </Animated.View>
      )}

      <View style={[styles.wrap, { width: size + 28, height: size + 28 }]}>
        {recording && <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]} />}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.button, 
            { 
              width: size, 
              height: size, 
              borderRadius: size / 2,
              transform: [{ translateX: panX }, { scale: recording ? 1.15 : 1 }],
              opacity: disabled ? 0.4 : 1
            }
          ]}
        >
          <Ionicons name={recording ? "radio" : "mic"} size={size * 0.34} color={colors.primary} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  slideOverlay: {
    position: "absolute",
    right: "100%",
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 180,
    justifyContent: "flex-end",
  },
  recordIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  timerText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
  },
  slideText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 12,
    borderColor: colors.primaryLight,
    ...shadow,
  },
});
