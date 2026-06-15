import { ReactNode } from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Text } from "@/components/Text";
import { colors, radius } from "@/constants/theme";

type Props = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
};

export function Button({ children, variant = "primary", onPress, style, disabled = false }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant !== "primary" && styles.darkLabel]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primaryLight,
  },
  outline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  darkLabel: {
    color: colors.primary,
  },
});
