import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";

const items = [
  { icon: "person-outline" as const, label: "Name", value: "Ayan" },
  { icon: "mail-outline" as const, label: "Email", value: "ayan@example.com" },
  { icon: "language-outline" as const, label: "Native language", value: "Kazakh" },
  { icon: "flag-outline" as const, label: "Target language", value: "English" },
  { icon: "school-outline" as const, label: "Current level", value: "A2" },
  { icon: "notifications-outline" as const, label: "Reminder", value: "20:00" },
];

export default function ProfileScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
        <Text variant="subtitle" style={{ marginTop: 10 }}>Ayan</Text>
        <Text variant="caption">ayan@example.com</Text>
      </View>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {items.map((item, index) => (
          <View key={item.label} style={[styles.row, index !== items.length - 1 && styles.border]}>
            <View style={styles.rowIcon}>
              <Ionicons name={item.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption">{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="subtitle">Account</Text>
        <Text variant="caption" style={{ marginTop: 5 }}>
          Profile is only for identity and settings. Your learning analytics live in Progress.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: 8,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "900",
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  value: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "700",
  },
});
