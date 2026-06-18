import { StyleSheet, View, Pressable, ActivityIndicator, Modal, TouchableWithoutFeedback, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors } from "@/constants/theme";
import { router } from "expo-router";
import { api, isUnauthorizedError, removeToken } from "@/utils/api";
import { useState, useEffect } from "react";

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get("/users/me");
        setUser(response.data);
      } catch (err) {
        if (isUnauthorizedError(err)) {
          await removeToken();
          router.replace("/login");
          return;
        }
        console.error("Failed to load user profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await removeToken();
    router.replace("/login");
  };

  const selectLanguage = async (lang: string) => {
    setShowLanguageModal(false);
    setUser({ ...user, native_language: lang });
    try {
      await api.put(`/users/${user.id}`, { native_language: lang });
    } catch (err) {
      console.error("Failed to update language", err);
    }
  };

  const selectLevel = async (level: string) => {
    setShowLevelModal(false);
    setUser({ ...user, cefr_level: level });
    try {
      await api.put(`/users/${user.id}`, { cefr_level: level });
    } catch (err) {
      console.error("Failed to update level", err);
    }
  };

  const saveName = async () => {
    if (!editName.trim()) return;
    setShowNameModal(false);
    setUser({ ...user, name: editName });
    try {
      await api.put(`/users/${user.id}`, { name: editName });
    } catch (err) {
      console.error("Failed to update name", err);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const items = [
    { icon: "person-outline" as const, label: "Name", value: user?.name || "N/A", onPress: () => { setEditName(user?.name || ""); setShowNameModal(true); } },
    { icon: "mail-outline" as const, label: "Email", value: user?.email || "N/A" },
    { icon: "language-outline" as const, label: "Native language", value: user?.native_language || "N/A", onPress: () => setShowLanguageModal(true) },
    { icon: "school-outline" as const, label: "Current level", value: user?.cefr_level || "N/A", onPress: () => setShowLevelModal(true) },
  ];

  const firstLetter = (user?.name || "?")[0].toUpperCase();

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
        <Text variant="subtitle" style={{ marginTop: 10 }}>{user?.name || "Unknown"}</Text>
        <Text variant="caption">{user?.email || "No email"}</Text>
      </View>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {items.map((item, index) => (
          <Pressable 
            key={item.label} 
            style={[styles.row, index !== items.length - 1 && styles.border]}
            onPress={item.onPress}
            disabled={!item.onPress}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={item.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption">{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      {user?.role === "admin" ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Pressable style={styles.row} onPress={() => router.push("/admin")}>
            <View style={styles.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption">Admin</Text>
              <Text style={styles.value}>Users, providers, speech, logs</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        </Card>
      ) : null}

      <Card style={{ padding: 16 }}>
        <Pressable onPress={handleLogout} style={[styles.logoutButton, { marginTop: 0 }]}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </Card>

      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLanguageModal(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text variant="subtitle">Select Native Language</Text>
            <Pressable onPress={() => setShowLanguageModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <Pressable 
            style={[styles.langOption, user?.native_language === 'ru' && styles.langOptionSelected]} 
            onPress={() => selectLanguage('ru')}
          >
            <Text style={[styles.langText, user?.native_language === 'ru' && styles.langTextSelected]}>Russian (ru)</Text>
            {user?.native_language === 'ru' && <Ionicons name="checkmark" size={20} color={colors.primary} />}
          </Pressable>

          <Pressable 
            style={[styles.langOption, user?.native_language === 'kk' && styles.langOptionSelected]} 
            onPress={() => selectLanguage('kk')}
          >
            <Text style={[styles.langText, user?.native_language === 'kk' && styles.langTextSelected]}>Kazakh (kk)</Text>
            {user?.native_language === 'kk' && <Ionicons name="checkmark" size={20} color={colors.primary} />}
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNameModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNameModal(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text variant="subtitle">Edit Name</Text>
            <Pressable onPress={() => setShowNameModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <TextInput 
            style={styles.input} 
            value={editName}
            onChangeText={setEditName}
            placeholder="Enter your name"
            autoCapitalize="words"
            autoFocus
          />
          
          <Pressable 
            style={[styles.saveButton, !editName.trim() && { opacity: 0.5 }]} 
            onPress={saveName}
            disabled={!editName.trim()}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={showLevelModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLevelModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLevelModal(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text variant="subtitle">Select CEFR Level</Text>
            <Pressable onPress={() => setShowLevelModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
            <Pressable 
              key={lvl}
              style={[styles.langOption, user?.cefr_level === lvl && styles.langOptionSelected]} 
              onPress={() => selectLevel(lvl)}
            >
              <Text style={[styles.langText, user?.cefr_level === lvl && styles.langTextSelected]}>{lvl}</Text>
              {user?.cefr_level === lvl && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      </Modal>
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
  logoutButton: {
    marginTop: 20,
    backgroundColor: "#fff0f0",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffcaca",
  },
  logoutText: {
    color: "#ff3b30",
    fontWeight: "700",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  langOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  langText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  langTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
