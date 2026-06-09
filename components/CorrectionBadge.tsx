import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors, radius } from "@/constants/theme";

export function CorrectionBadge({
  pattern,
  better,
  why,
}: {
  pattern: string;
  better: string;
  why: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.badge}>
        <Ionicons name="sparkles" size={12} color={colors.primary} />
        <Text style={styles.badgeText}>{pattern}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color={colors.primary} />
      </Pressable>
      {open && (
        <Card style={styles.detail}>
          <Text style={styles.better}>Better: {better}</Text>
          <Text variant="caption" style={styles.why}>{why}</Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-end",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  detail: {
    width: 230,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  better: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  why: {
    marginTop: 4,
  },
});
