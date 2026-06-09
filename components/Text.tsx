import { ReactNode } from "react";
import { StyleSheet, StyleProp, Text as RNText, TextStyle } from "react-native";
import { colors } from "@/constants/theme";

type Props = {
  children: ReactNode;
  variant?: "title" | "subtitle" | "body" | "caption" | "eyebrow";
  style?: StyleProp<TextStyle>;
};

export function Text({ children, variant = "body", style }: Props) {
  return <RNText style={[styles.base, styles[variant], style]}>{children}</RNText>;
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    color: colors.muted,
  },
});
