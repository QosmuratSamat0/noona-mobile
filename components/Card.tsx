import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, shadow } from "@/constants/theme";

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow,
  },
});
