import { StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { colors, radius, shadow } from "@/constants/theme";

export function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    paddingVertical: 12,
    ...shadow,
  },
  value: {
    fontSize: 18,
    fontWeight: "800",
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
});
