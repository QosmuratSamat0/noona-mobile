import { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/constants/theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
};

export function Screen({ children, scroll = true, padded = true }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, padded && styles.padded]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, padded && styles.padded]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 16,
    paddingBottom: 28,
  },
  padded: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
});
