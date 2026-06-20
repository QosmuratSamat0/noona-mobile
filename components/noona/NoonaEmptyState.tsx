import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";
import { NoonaMascot } from "./NoonaMascot";
import type { NoonaBrandProps } from "./types";

type Props = NoonaBrandProps & {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function NoonaEmptyState({
  size = "md",
  mood = "encouraging",
  variant = "empty",
  title,
  description,
  actionLabel,
  onAction,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <View style={[styles.root, style]}>
      <NoonaMascot size={size} mood={mood} variant={variant} accessibilityLabel={accessibilityLabel} />
      <View style={styles.copy}>
        <Text variant="subtitle" style={styles.title}>{title}</Text>
        {description && <Text variant="caption" style={styles.description}>{description}</Text>}
      </View>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  copy: {
    maxWidth: 300,
    alignItems: "center",
    gap: 5,
  },
  title: {
    textAlign: "center",
  },
  description: {
    textAlign: "center",
  },
  action: {
    minHeight: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
  },
  actionPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  actionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
