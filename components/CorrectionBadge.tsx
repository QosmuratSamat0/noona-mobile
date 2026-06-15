import { useMemo, useState } from "react";
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

const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);

export const changedPhrase = (original: string, better: string) => {
  const originalWords = words(original);
  const betterWords = words(better);

  if (originalWords.length > 4 && betterWords.length <= 3) {
    return { wrong: "", correct: betterWords.join(" ") || better };
  }

  let start = 0;
  while (
    start < originalWords.length &&
    start < betterWords.length &&
    originalWords[start].toLowerCase() === betterWords[start].toLowerCase()
  ) {
    start += 1;
  }

  let endOriginal = originalWords.length - 1;
  let endBetter = betterWords.length - 1;
  while (
    endOriginal >= start &&
    endBetter >= start &&
    originalWords[endOriginal].toLowerCase() === betterWords[endBetter].toLowerCase()
  ) {
    endOriginal -= 1;
    endBetter -= 1;
  }

  return {
    wrong: originalWords.slice(start, endOriginal + 1).join(" "),
    correct: betterWords.slice(start, endBetter + 1).join(" ") || better,
  };
};

const renderHighlightedSentence = (sentence: string, phrase: string, tone: "wrong" | "correct") => {
  const index = phrase ? sentence.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  if (index < 0) {
    return <Text style={styles.sentenceText}>{sentence}</Text>;
  }
  const before = sentence.slice(0, index);
  const match = sentence.slice(index, index + phrase.length);
  const after = sentence.slice(index + phrase.length);
  return (
    <Text style={styles.sentenceText}>
      {before}
      <Text style={tone === "wrong" ? styles.highlightWrong : styles.highlightCorrect}>{match}</Text>
      {after}
    </Text>
  );
};

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
  const changed = useMemo(
    () => changedPhrase(correction?.original || "", correction?.better || ""),
    [correction?.original, correction?.better],
  );

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
                  <View style={styles.sentenceBox}>
                    <View style={styles.quoteLine} />
                    {renderHighlightedSentence(correction.original, changed.wrong, "wrong")}
                  </View>

                  <View style={styles.fixHeader}>
                    <View style={styles.fixIcon}>
                      <Ionicons name="sparkles" size={18} color={colors.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fixHeadline}>Grammar fix</Text>
                      <Text variant="caption">{changed.wrong ? "Change this part" : "Add the missing word"}</Text>
                    </View>
                  </View>

                  <View style={styles.fixCard}>
                    <Text style={styles.fixTitle}>{correction.pattern === "grammar" ? "What to fix" : correction.pattern}</Text>
                    <View style={styles.compareRow}>
                      <View style={styles.compareCol}>
                        <Text variant="caption">You said</Text>
                        <Text style={styles.wrongText}>{changed.wrong || "missing word"}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.muted} />
                      <View style={styles.compareCol}>
                        <Text variant="caption">Better</Text>
                        <Text style={styles.correctText}>{changed.correct}</Text>
                      </View>
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
                  <View style={styles.sentenceBox}>
                    <View style={styles.quoteLine} />
                    {renderHighlightedSentence(correction.better, changed.correct, "correct")}
                  </View>
                  <View style={styles.fixHeader}>
                    <Text style={styles.pronScore}>93%</Text>
                    <Text style={styles.pronHint}>Well done!</Text>
                  </View>
                  <View style={styles.fixCard}>
                    <Text style={styles.fixTitle}>{changed.correct}</Text>
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
                        <Text style={styles.phoneCell}>{changed.correct}</Text>
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
  const changed = useMemo(() => changedPhrase(original, better), [original, better]);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(true)} style={styles.badge}>
        <Ionicons name="sparkles" size={12} color={colors.primary} />
        <Text style={styles.badgeText} numberOfLines={1}>
          {changed.wrong || "missing word"} {"->"} {changed.correct}
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
