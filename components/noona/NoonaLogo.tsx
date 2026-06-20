import { StyleSheet, View } from "react-native";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";
import { NoonaMascot } from "./NoonaMascot";
import type { NoonaBrandProps } from "./types";

type Props = NoonaBrandProps & {
  showTagline?: boolean;
};

export function NoonaLogo({
  size = "md",
  mood = "happy",
  variant = "icon",
  showTagline = false,
  style,
  accessibilityLabel,
}: Props) {
  const welcome = variant === "welcome";

  return (
    <View style={[styles.root, welcome ? styles.welcome : styles.inline, style]}>
      <NoonaMascot size={size} mood={mood} variant={variant} accessibilityLabel={accessibilityLabel} />
      <View style={welcome ? styles.centeredCopy : styles.copy}>
        <Text style={[styles.name, size === "sm" && styles.nameSmall]}>Noona</Text>
        {showTagline && <Text style={styles.tagline}>AI English Speaking Coach</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
  },
  inline: {
    flexDirection: "row",
    gap: 10,
  },
  welcome: {
    gap: 12,
  },
  copy: {
    gap: 1,
  },
  centeredCopy: {
    alignItems: "center",
    gap: 3,
  },
  name: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
  },
  nameSmall: {
    fontSize: 19,
    lineHeight: 23,
  },
  tagline: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
