import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, shadow } from "@/constants/theme";
import type { NoonaBrandProps, NoonaMood, NoonaSize, NoonaVariant } from "./types";

const mascotSource = require("@/assets/branding/noona-mascot.png");

const dimensions: Record<NoonaVariant, Record<NoonaSize, number>> = {
  icon: { sm: 40, md: 64, lg: 92 },
  avatar: { sm: 28, md: 40, lg: 56 },
  empty: { sm: 76, md: 112, lg: 148 },
  welcome: { sm: 88, md: 132, lg: 176 },
  loading: { sm: 44, md: 64, lg: 88 },
};

const accents: Record<NoonaMood, { start: string; end: string; badge: keyof typeof Ionicons.glyphMap }> = {
  happy: { start: "#edf7ff", end: "#e7ecff", badge: "sparkles" },
  neutral: { start: "#f5f7ff", end: "#eef0ff", badge: "chatbubble-ellipses" },
  encouraging: { start: "#fff5e9", end: "#edf0ff", badge: "heart" },
};

export function NoonaMascot({
  size = "md",
  variant = "icon",
  mood = "happy",
  style,
  accessibilityLabel = "Noona AI coach",
}: NoonaBrandProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const dimension = dimensions[variant][size];
  const accent = accents[mood];
  const isAvatar = variant === "avatar";
  const isLoading = variant === "loading";
  const isScene = variant === "empty" || variant === "welcome";

  useEffect(() => {
    if (!isLoading) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isLoading, pulse]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.root,
        { width: dimension, height: dimension },
        isScene && styles.sceneShadow,
        style,
      ]}
    >
      <LinearGradient
        colors={[accent.start, accent.end]}
        style={[
          StyleSheet.absoluteFillObject,
          styles.backdrop,
          isAvatar && styles.avatarBackdrop,
          isLoading && styles.loadingBackdrop,
        ]}
      />
      <Animated.Image
        source={mascotSource}
        resizeMode="contain"
        style={[
          styles.image,
          isAvatar && styles.avatarImage,
          isScene && styles.sceneImage,
          { transform: [{ scale: pulse }] },
        ]}
      />
      {isScene && (
        <View style={[styles.moodBadge, { width: dimension * 0.24, height: dimension * 0.24 }]}>
          <Ionicons name={accent.badge} size={dimension * 0.13} color={colors.primary} />
        </View>
      )}
      {isLoading && <View style={styles.loadingDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(109,94,252,0.09)",
  },
  avatarBackdrop: {
    borderRadius: 999,
    borderColor: "rgba(109,94,252,0.18)",
  },
  loadingBackdrop: {
    borderRadius: 999,
  },
  image: {
    width: "92%",
    height: "92%",
  },
  avatarImage: {
    width: "108%",
    height: "108%",
  },
  sceneImage: {
    width: "96%",
    height: "96%",
  },
  sceneShadow: shadow,
  moodBadge: {
    position: "absolute",
    right: -2,
    top: -2,
    minWidth: 24,
    minHeight: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
    backgroundColor: colors.card,
  },
  loadingDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.card,
    backgroundColor: colors.green,
  },
});
