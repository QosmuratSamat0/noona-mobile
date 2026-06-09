import { useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, shadow } from "@/constants/theme";

export function MicButton({ size = 96, onSubmit }: { size?: number; onSubmit?: () => void }) {
  const [recording, setRecording] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const start = () => {
    setRecording(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    ).start();
  };

  const stop = () => {
    setRecording(false);
    pulse.stopAnimation();
    pulse.setValue(1);
    onSubmit?.();
  };

  return (
    <View style={[styles.wrap, { width: size + 28, height: size + 28 }]}>
      {recording && <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]} />}
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Ionicons name={recording ? "radio" : "mic"} size={size * 0.34} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
