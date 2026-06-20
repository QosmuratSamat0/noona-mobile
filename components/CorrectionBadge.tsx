import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/Text";
import { colors, radius, shadow } from "@/constants/theme";

type Correction = {
  pattern: string;
  original: string;
  better: string;
  why: string;
};

export type CorrectionDetail = Correction;

export function CorrectionSheet({
  correction,
  visible,
  onClose,
}: {
  correction: CorrectionDetail | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"grammar" | "pronunciation">("grammar");
  const insets = useSafeAreaInsets();

  if (!correction) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheetDock} pointerEvents="box-none">
          <View style={[styles.sheet, { paddingBottom: Math.max(22, insets.bottom + 14) }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text variant="subtitle">Feedback</Text>
              <Pressable onPress={onClose} style={styles.close}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.tabs}>
              <Pressable onPress={() => setTab("grammar")} style={[styles.tab, tab === "grammar" && styles.tabActive]}>
                <Text style={[styles.tabText, tab === "grammar" && styles.tabTextActive]}>Grammar</Text>
              </Pressable>
              <Pressable onPress={() => setTab("pronunciation")} style={[styles.tab, tab === "pronunciation" && styles.tabActive]}>
                <Text style={[styles.tabText, tab === "pronunciation" && styles.tabTextActive]}>Pronunciation</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {tab === "grammar" ? (
                <View style={styles.panel}>
                  <Text variant="eyebrow" style={{ color: colors.primary }}>Grammar</Text>
                  <View style={styles.fullSentenceCard}>
                    <Text variant="caption">Original</Text>
                    <Text style={styles.originalSentence}>{correction.original}</Text>
                  </View>

                  <View style={styles.fixHeader}>
                    <View style={styles.fixIcon}>
                      <Ionicons name="sparkles" size={18} color={colors.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fixHeadline}>Sentence correction</Text>
                      <Text variant="caption">Correct the sentence without changing the meaning.</Text>
                    </View>
                  </View>

                  <View style={styles.fixCard}>
                    <Text style={styles.fixTitle}>{correction.pattern === "grammar" ? "Better sentence" : correction.pattern}</Text>
                    <View style={styles.fullSentenceBlock}>
                      <Text variant="caption">Better</Text>
                      <Text style={styles.correctSentence}>{correction.better}</Text>
                    </View>
                    <View style={styles.ruleBox}>
                      <Ionicons name="bulb-outline" size={17} color={colors.orange} />
                      <Text style={styles.ruleText}>{correction.why || "Use the corrected phrase in this sentence."}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.panel}>
                  <Text variant="eyebrow" style={{ color: colors.primary }}>Pronunciation</Text>
                  <View style={styles.fullSentenceCard}>
                    <Text variant="caption">Practice sentence</Text>
                    <Text style={styles.correctSentence}>{correction.better}</Text>
                  </View>
                  <View style={styles.fixHeader}>
                    <Text style={styles.pronScore}>93%</Text>
                    <Text style={styles.pronHint}>Well done!</Text>
                  </View>
                  <View style={styles.fixCard}>
                    <Text style={styles.fixTitle}>Say the full sentence</Text>
                    <View style={styles.phoneHeader}>
                      <Text style={styles.phoneHead}>Syllable</Text>
                      <Text style={styles.phoneHead}>Phone</Text>
                      <Text style={styles.phoneHead}>Feedback</Text>
                    </View>
                    {[
                      { phone: "/w/", feedback: "Excellent!", color: colors.green },
                      { phone: "/aa/", feedback: "Very good", color: colors.green },
                      { phone: "/ch/", feedback: "Sounds clear", color: colors.red },
                    ].map((row) => (
                      <View key={row.phone} style={styles.phoneRow}>
                        <Text style={styles.phoneCell}>sentence</Text>
                        <Text style={styles.phoneCell}>{row.phone}</Text>
                        <Text style={[styles.phoneCell, { color: row.color }]}>{row.feedback}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function CorrectionBadge({ pattern, original, better, why }: Correction) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(true)} style={styles.badge}>
        <Ionicons name="sparkles" size={12} color={colors.primary} />
        <Text style={styles.badgeText} numberOfLines={1}>
          View sentence correction
        </Text>
      </Pressable>
      <CorrectionSheet correction={{ pattern, original, better, why }} visible={open} onClose={() => setOpen(false)} />
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
    maxWidth: 260,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    flexShrink: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
  },
  sheetDock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
  },
  sheet: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadow,
  },
  sheetScroll: {
    paddingBottom: 6,
  },
  handle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d9dbe7",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f8",
  },
  tabs: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 23,
    flexDirection: "row",
    backgroundColor: "#f4f4f8",
    padding: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#fff",
    ...shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  tabTextActive: {
    color: colors.text,
  },
  panel: {
    marginTop: 18,
    gap: 14,
  },
  sentenceBox: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  quoteLine: {
    width: 2,
    minHeight: 46,
    borderRadius: 1,
    backgroundColor: colors.muted,
  },
  sentenceText: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "700",
  },
  fullSentenceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f8fafc",
    padding: 14,
    gap: 6,
  },
  fullSentenceBlock: {
    marginTop: 14,
    gap: 6,
  },
  originalSentence: {
    color: "#991b1b",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
  },
  correctSentence: {
    color: "#047857",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
  },
  highlightWrong: {
    borderRadius: 6,
    backgroundColor: colors.redLight,
    color: "#991b1b",
    fontWeight: "900",
  },
  highlightCorrect: {
    borderRadius: 6,
    backgroundColor: colors.greenLight,
    color: "#047857",
    fontWeight: "900",
  },
  fixHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fixIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangeLight,
  },
  fixHeadline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  pronScore: {
    color: colors.green,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  pronHint: {
    color: colors.green,
    fontWeight: "800",
  },
  fixCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    padding: 16,
  },
  fixTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  compareRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  compareCol: {
    flex: 1,
    minWidth: 0,
  },
  wrongText: {
    marginTop: 4,
    color: "#991b1b",
    fontSize: 15,
    fontWeight: "900",
    textDecorationLine: "line-through",
  },
  correctText: {
    marginTop: 4,
    color: "#047857",
    fontSize: 15,
    fontWeight: "900",
  },
  ruleBox: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: colors.orangeLight,
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  ruleText: {
    flex: 1,
    color: "#9a3412",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  phoneHeader: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#eeeeef",
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  phoneHead: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  phoneRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  phoneCell: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
});
