import { ComponentProps, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Text } from "@/components/Text";
import { colors, shadow } from "@/constants/theme";
import { api, isUnauthorizedError, removeToken } from "@/utils/api";

type AdminTab = "dashboard" | "users" | "providers" | "speech" | "logs";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  cefr_level?: string;
  native_language?: string;
};

type AdminSettings = {
  environment: string;
  providers: {
    stt: { provider: string; grpc_addr: string; service_url: string; groq_model: string; groq_api_key?: string; groq_api_key_set: boolean; request_timeout: string };
    llm: {
      provider: string;
      gemini_model: string;
      gemini_api_key?: string;
      gemini_api_key_set: boolean;
      groq_model: string;
      groq_api_key?: string;
      groq_api_key_set: boolean;
      openrouter_model: string;
      openrouter_api_key?: string;
      openrouter_api_key_set: boolean;
    };
    tts: {
      provider: string;
      grpc_addr: string;
      service_url: string;
      request_timeout: string;
      elevenlabs_url: string;
      elevenlabs_model: string;
      elevenlabs_voice_id: string;
      elevenlabs_api_key?: string;
      elevenlabs_api_key_set: boolean;
      fish_audio_url: string;
      fish_audio_model: string;
      fish_audio_voice_id: string;
      fish_audio_api_key?: string;
      fish_audio_api_key_set: boolean;
      notegpt_url: string;
      notegpt_model: string;
      notegpt_voice_id: string;
      notegpt_api_key?: string;
      notegpt_api_key_set: boolean;
    };
  };
  speech: {
    default_cefr: string;
    reply_length: string;
    ignore_punctuation: boolean;
    require_full_sentence: boolean;
    tts_break_ms: number;
  };
  runtime: {
    audio_worker_queue: string;
    audio_worker_count: number;
    restart_required: boolean;
  };
};

type AdminLog = {
  time: string;
  level: string;
  area: string;
  message: string;
};

const emptyUser = { name: "", email: "", password: "", role: "user" as "user" | "admin" };

export default function AdminScreen() {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [newUser, setNewUser] = useState(emptyUser);
  const [saving, setSaving] = useState(false);
  const [logLevelFilter, setLogLevelFilter] = useState("all");
  const [logAreaFilter, setLogAreaFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const [usersRes, settingsRes, logsRes] = await Promise.all([
        api.get("/users"),
        api.get("/admin/settings"),
        api.get("/admin/logs"),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setSettings(settingsRes.data || null);
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await removeToken();
        router.replace("/login");
        return;
      }
      console.error("Failed to load admin", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const stats = useMemo(() => ({
    users: users.length,
    admins: users.filter((user) => user.role === "admin").length,
    regularUsers: users.filter((user) => user.role !== "admin").length,
    logs: logs.length,
    restart: settings?.runtime.restart_required ? "Yes" : "No",
    stt: settings?.providers.stt.provider || "-",
    llm: settings?.providers.llm.provider || "-",
    tts: settings?.providers.tts.provider || "-",
    workers: settings?.runtime.audio_worker_count || 0,
  }), [logs, settings, users]);

  const logAreas = useMemo(() => ["all", ...Array.from(new Set(logs.map((item) => item.area))).sort()], [logs]);
  const filteredLogs = useMemo(() => {
    const search = logSearch.trim().toLowerCase();
    return logs.filter((item) => {
      const levelMatch = logLevelFilter === "all" || item.level === logLevelFilter;
      const areaMatch = logAreaFilter === "all" || item.area === logAreaFilter;
      const searchMatch = !search || `${item.level} ${item.area} ${item.message}`.toLowerCase().includes(search);
      return levelMatch && areaMatch && searchMatch;
    });
  }, [logAreaFilter, logLevelFilter, logSearch, logs]);

  const recordAdminAction = async (area: string, message: string, level = "info") => {
    try {
      const response = await api.post("/admin/logs", { level, area, message });
      setLogs((items) => [response.data, ...items].slice(0, 200));
    } catch (error) {
      console.error("Failed to record admin action", error);
    }
  };

  const createUser = async () => {
    if (!newUser.email.trim() || !newUser.password.trim()) return;
    setSaving(true);
    try {
      await api.post("/users/", newUser);
      await recordAdminAction("users", `Created user ${newUser.email.trim()}.`);
      setNewUser(emptyUser);
      await loadAdmin();
    } catch (error) {
      console.error("Failed to create user", error);
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (user: UserItem, patch: Partial<UserItem>) => {
    const next = { ...user, ...patch };
    setUsers((items) => items.map((item) => item.id === user.id ? next : item));
    try {
      await api.put(`/users/${user.id}`, {
        name: next.name,
        email: next.email,
        role: next.role,
        cefr_level: next.cefr_level,
        native_language: next.native_language,
      });
      await recordAdminAction("users", `Updated user ${next.email || next.id}.`);
    } catch (error) {
      console.error("Failed to update user", error);
      await loadAdmin();
    }
  };

  const deleteUser = async (user: UserItem) => {
    setUsers((items) => items.filter((item) => item.id !== user.id));
    try {
      await api.delete(`/users/${user.id}`);
      await recordAdminAction("users", `Deleted user ${user.email || user.id}.`, "warn");
    } catch (error) {
      console.error("Failed to delete user", error);
      await loadAdmin();
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const response = await api.put("/admin/settings", settings);
      setSettings(response.data);
      const logsResponse = await api.get("/admin/logs");
      setLogs(Array.isArray(logsResponse.data) ? logsResponse.data : []);
    } catch (error) {
      console.error("Failed to save settings", error);
    } finally {
      setSaving(false);
    }
  };

  const setSettingsPatch = (patch: Partial<AdminSettings>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/profile");
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption">Loading admin...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="title">Admin</Text>
          <Text variant="caption">Users, providers, speech, and logs.</Text>
        </View>
        <Pressable onPress={loadAdmin} style={styles.iconButton}>
          <Ionicons name="refresh" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Stat value={String(stats.users)} label="Users" />
        <Stat value={String(stats.admins)} label="Admins" />
        <Stat value={stats.restart} label="Restart" />
      </View>

      <View style={styles.tabs}>
        {([
          ["dashboard", "Dashboard", "speedometer-outline"],
          ["users", "Users", "people-outline"],
          ["providers", "Providers", "hardware-chip-outline"],
          ["speech", "Speech", "mic-outline"],
          ["logs", "Logs", "reader-outline"],
        ] as const).map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
            <Ionicons name={icon} size={15} color={tab === key ? colors.primary : colors.muted} />
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "dashboard" && settings && (
        <>
          <Card style={styles.dashboardCard}>
            <View style={styles.dashboardHeader}>
              <View>
                <Text variant="subtitle">System overview</Text>
                <Text variant="caption">Environment: {settings.environment || "local"}</Text>
              </View>
              <View style={[styles.statusPill, settings.runtime.restart_required && styles.statusPillWarn]}>
                <Ionicons name={settings.runtime.restart_required ? "warning-outline" : "checkmark-circle"} size={15} color={settings.runtime.restart_required ? colors.orange : colors.green} />
                <Text style={[styles.statusPillText, settings.runtime.restart_required && styles.statusPillTextWarn]}>
                  {settings.runtime.restart_required ? "Restart needed" : "Running"}
                </Text>
              </View>
            </View>

            <View style={styles.dashboardGrid}>
              <Metric icon="people-outline" label="Users" value={String(stats.users)} />
              <Metric icon="shield-checkmark-outline" label="Admins" value={String(stats.admins)} />
              <Metric icon="person-outline" label="Regular" value={String(stats.regularUsers)} />
              <Metric icon="reader-outline" label="Logs" value={String(stats.logs)} />
            </View>
          </Card>

          <Card style={styles.dashboardCard}>
            <Text variant="subtitle">Providers</Text>
            <StatusRow label="STT" value={stats.stt} icon="mic-outline" onPress={() => setTab("providers")} />
            <StatusRow label="LLM" value={stats.llm} icon="hardware-chip-outline" onPress={() => setTab("providers")} />
            <StatusRow label="TTS" value={stats.tts} icon="volume-high-outline" onPress={() => setTab("providers")} />
          </Card>

          <Card style={styles.dashboardCard}>
            <Text variant="subtitle">Runtime</Text>
            <StatusRow label="Worker queue" value={settings.runtime.audio_worker_queue || "-"} icon="list-outline" />
            <StatusRow label="Audio workers" value={String(stats.workers)} icon="flash-outline" />
            <StatusRow label="Default CEFR" value={settings.speech.default_cefr} icon="school-outline" onPress={() => setTab("speech")} />
          </Card>

          <Card style={styles.dashboardCard}>
            <View style={styles.dashboardHeader}>
              <Text variant="subtitle">Recent logs</Text>
              <Pressable onPress={() => setTab("logs")} style={styles.smallAction}>
                <Text style={styles.smallActionText}>Open</Text>
              </Pressable>
            </View>
            {logs.slice(0, 3).length ? logs.slice(0, 3).map((item, index) => (
              <View key={`${item.time}-${index}`} style={styles.logRow}>
                <Text style={styles.logMeta}>{item.level.toUpperCase()} / {item.area}</Text>
                <Text style={styles.logMessage}>{item.message}</Text>
                <Text variant="caption">{new Date(item.time).toLocaleString()}</Text>
              </View>
            )) : (
              <Text variant="caption">No admin logs yet.</Text>
            )}
          </Card>
        </>
      )}

      {tab === "users" && (
        <>
          <Card style={styles.formCard}>
            <Text variant="subtitle">Create user</Text>
            <Input label="Name" value={newUser.name} onChangeText={(name) => setNewUser({ ...newUser, name })} />
            <Input label="Email" value={newUser.email} onChangeText={(email) => setNewUser({ ...newUser, email })} autoCapitalize="none" />
            <Input label="Password" value={newUser.password} onChangeText={(password) => setNewUser({ ...newUser, password })} secureTextEntry />
            <Segmented
              value={newUser.role}
              options={["user", "admin"]}
              onChange={(role) => setNewUser({ ...newUser, role: role as "user" | "admin" })}
            />
            <Pressable onPress={createUser} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
              <Text style={styles.primaryButtonText}>Create user</Text>
            </Pressable>
          </Card>

          {users.map((user) => (
            <Card key={user.id} style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(user.name || user.email || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.userName} numberOfLines={1}>{user.name || "Unnamed"}</Text>
                  <Text variant="caption" numberOfLines={1}>{user.email}</Text>
                </View>
                <Pressable onPress={() => deleteUser(user)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={17} color={colors.red} />
                </Pressable>
              </View>
              <View style={styles.inlineControls}>
                <Segmented value={user.role} options={["user", "admin"]} onChange={(role) => updateUser(user, { role: role as "user" | "admin" })} />
                <Segmented value={user.cefr_level || "A1"} options={["A1", "A2", "B1", "B2", "C1", "C2"]} onChange={(level) => updateUser(user, { cefr_level: level })} />
              </View>
            </Card>
          ))}
        </>
      )}

      {tab === "providers" && settings && (
        <Card style={styles.formCard}>
          <ProviderSection
            title="STT provider"
            value={settings.providers.stt.provider}
            options={["grpc", "groq"]}
            onChange={(provider) => setSettingsPatch({ providers: { ...settings.providers, stt: { ...settings.providers.stt, provider } } })}
          />
          {settings.providers.stt.provider === "grpc" && (
            <Input label="STT gRPC address" value={settings.providers.stt.grpc_addr} onChangeText={(grpc_addr) => setSettingsPatch({ providers: { ...settings.providers, stt: { ...settings.providers.stt, grpc_addr } } })} />
          )}
          {settings.providers.stt.provider === "groq" && (
            <>
              <Input label="Groq API key" value={settings.providers.stt.groq_api_key || ""} onChangeText={(groq_api_key) => setSettingsPatch({ providers: { ...settings.providers, stt: { ...settings.providers.stt, groq_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.stt.groq_api_key_set} value={settings.providers.stt.groq_api_key} />
              <Input label="Groq STT model" value={settings.providers.stt.groq_model} onChangeText={(groq_model) => setSettingsPatch({ providers: { ...settings.providers, stt: { ...settings.providers.stt, groq_model } } })} />
            </>
          )}

          <ProviderSection
            title="LLM provider"
            value={settings.providers.llm.provider}
            options={["gemini", "groq", "openrouter"]}
            onChange={(provider) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, provider } } })}
          />
          {settings.providers.llm.provider === "gemini" && (
            <>
              <Input label="Gemini API key" value={settings.providers.llm.gemini_api_key || ""} onChangeText={(gemini_api_key) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, gemini_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.llm.gemini_api_key_set} value={settings.providers.llm.gemini_api_key} />
              <Input label="Gemini model" value={settings.providers.llm.gemini_model} onChangeText={(gemini_model) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, gemini_model } } })} />
            </>
          )}
          {settings.providers.llm.provider === "groq" && (
            <>
              <Input label="Groq API key" value={settings.providers.llm.groq_api_key || ""} onChangeText={(groq_api_key) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, groq_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.llm.groq_api_key_set} value={settings.providers.llm.groq_api_key} />
              <Input label="Groq LLM model" value={settings.providers.llm.groq_model} onChangeText={(groq_model) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, groq_model } } })} />
            </>
          )}
          {settings.providers.llm.provider === "openrouter" && (
            <>
              <Input label="OpenRouter API key" value={settings.providers.llm.openrouter_api_key || ""} onChangeText={(openrouter_api_key) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, openrouter_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.llm.openrouter_api_key_set} value={settings.providers.llm.openrouter_api_key} />
              <Input label="OpenRouter model" value={settings.providers.llm.openrouter_model} onChangeText={(openrouter_model) => setSettingsPatch({ providers: { ...settings.providers, llm: { ...settings.providers.llm, openrouter_model } } })} />
            </>
          )}

          <ProviderSection
            title="TTS provider"
            value={settings.providers.tts.provider}
            options={["grpc", "elevenlabs", "fish_audio", "notegpt"]}
            onChange={(provider) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, provider } } })}
          />
          {settings.providers.tts.provider === "grpc" && (
            <Input label="TTS gRPC address" value={settings.providers.tts.grpc_addr} onChangeText={(grpc_addr) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, grpc_addr } } })} />
          )}
          {settings.providers.tts.provider === "elevenlabs" && (
            <>
              <Input label="ElevenLabs URL" value={settings.providers.tts.elevenlabs_url} onChangeText={(elevenlabs_url) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, elevenlabs_url } } })} autoCapitalize="none" />
              <Input label="ElevenLabs API key" value={settings.providers.tts.elevenlabs_api_key || ""} onChangeText={(elevenlabs_api_key) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, elevenlabs_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.tts.elevenlabs_api_key_set} value={settings.providers.tts.elevenlabs_api_key} />
              <Input label="ElevenLabs model" value={settings.providers.tts.elevenlabs_model} onChangeText={(elevenlabs_model) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, elevenlabs_model } } })} autoCapitalize="none" />
              <Input label="ElevenLabs voice ID" value={settings.providers.tts.elevenlabs_voice_id} onChangeText={(elevenlabs_voice_id) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, elevenlabs_voice_id } } })} autoCapitalize="none" />
            </>
          )}
          {settings.providers.tts.provider === "fish_audio" && (
            <>
              <Input label="Fish Audio URL" value={settings.providers.tts.fish_audio_url} onChangeText={(fish_audio_url) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, fish_audio_url } } })} autoCapitalize="none" />
              <Input label="Fish Audio API key" value={settings.providers.tts.fish_audio_api_key || ""} onChangeText={(fish_audio_api_key) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, fish_audio_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.tts.fish_audio_api_key_set} value={settings.providers.tts.fish_audio_api_key} />
              <Input label="Fish Audio model" value={settings.providers.tts.fish_audio_model} onChangeText={(fish_audio_model) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, fish_audio_model } } })} autoCapitalize="none" />
              <Input label="Fish Audio voice ID" value={settings.providers.tts.fish_audio_voice_id} onChangeText={(fish_audio_voice_id) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, fish_audio_voice_id } } })} autoCapitalize="none" />
            </>
          )}
          {settings.providers.tts.provider === "notegpt" && (
            <>
              <Input label="NoteGPT URL" value={settings.providers.tts.notegpt_url} onChangeText={(notegpt_url) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, notegpt_url } } })} autoCapitalize="none" />
              <Input label="NoteGPT API key" value={settings.providers.tts.notegpt_api_key || ""} onChangeText={(notegpt_api_key) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, notegpt_api_key } } })} autoCapitalize="none" secureTextEntry />
              <KeyStatus configured={settings.providers.tts.notegpt_api_key_set} value={settings.providers.tts.notegpt_api_key} />
              <Input label="NoteGPT model" value={settings.providers.tts.notegpt_model} onChangeText={(notegpt_model) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, notegpt_model } } })} autoCapitalize="none" />
              <Input label="NoteGPT voice ID" value={settings.providers.tts.notegpt_voice_id} onChangeText={(notegpt_voice_id) => setSettingsPatch({ providers: { ...settings.providers, tts: { ...settings.providers.tts, notegpt_voice_id } } })} autoCapitalize="none" />
            </>
          )}
          <Pressable onPress={saveSettings} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
            <Text style={styles.primaryButtonText}>Save provider settings</Text>
          </Pressable>
          {settings.runtime.restart_required && <Text variant="caption">Provider clients are created on backend startup. Restart required.</Text>}
        </Card>
      )}

      {tab === "speech" && settings && (
        <Card style={styles.formCard}>
          <Text variant="subtitle">Speech settings</Text>
          <Segmented value={settings.speech.default_cefr} options={["A1", "A2", "B1", "B2", "C1", "C2"]} onChange={(default_cefr) => setSettingsPatch({ speech: { ...settings.speech, default_cefr } })} />
          <Segmented value={settings.speech.reply_length} options={["short", "medium", "long"]} onChange={(reply_length) => setSettingsPatch({ speech: { ...settings.speech, reply_length } })} />
          <Toggle label="Ignore punctuation-only feedback" value={settings.speech.ignore_punctuation} onChange={(ignore_punctuation) => setSettingsPatch({ speech: { ...settings.speech, ignore_punctuation } })} />
          <Toggle label="Require full-sentence corrections" value={settings.speech.require_full_sentence} onChange={(require_full_sentence) => setSettingsPatch({ speech: { ...settings.speech, require_full_sentence } })} />
          <Input
            label="TTS sentence break, ms"
            value={String(settings.speech.tts_break_ms)}
            keyboardType="number-pad"
            onChangeText={(value) => setSettingsPatch({ speech: { ...settings.speech, tts_break_ms: Number(value) || 0 } })}
          />
          <Pressable onPress={saveSettings} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
            <Text style={styles.primaryButtonText}>Save speech settings</Text>
          </Pressable>
        </Card>
      )}

      {tab === "logs" && (
        <Card style={styles.formCard}>
          <View style={styles.dashboardHeader}>
            <View>
              <Text variant="subtitle">Logs</Text>
              <Text variant="caption">{filteredLogs.length} of {logs.length} actions</Text>
            </View>
            <Pressable onPress={loadAdmin} style={styles.smallAction}>
              <Text style={styles.smallActionText}>Refresh</Text>
            </Pressable>
          </View>

          <View style={styles.filterBlock}>
            <Text style={styles.inputLabel}>Level</Text>
            <Segmented value={logLevelFilter} options={["all", "info", "warn", "error"]} onChange={setLogLevelFilter} />
          </View>
          <View style={styles.filterBlock}>
            <Text style={styles.inputLabel}>Area</Text>
            <Segmented value={logAreaFilter} options={logAreas} onChange={setLogAreaFilter} />
          </View>
          <Input
            label="Search"
            value={logSearch}
            onChangeText={setLogSearch}
            placeholder="Search action, area, message..."
            autoCapitalize="none"
          />

          {filteredLogs.length ? filteredLogs.map((item, index) => (
            <View key={`${item.time}-${index}`} style={styles.logRow}>
              <Text style={styles.logMeta}>{item.level.toUpperCase()} / {item.area}</Text>
              <Text style={styles.logMessage}>{item.message}</Text>
              <Text variant="caption">{new Date(item.time).toLocaleString()}</Text>
            </View>
          )) : (
            <Text variant="caption">No logs match this filter.</Text>
          )}
        </Card>
      )}
    </Screen>
  );
}

function ProviderSection({ title, value, options, onChange }: { title: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.providerSection}>
      <Text variant="subtitle">{title}</Text>
      <Segmented value={value} options={options} onChange={onChange} />
    </View>
  );
}

function Input(props: ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.muted} {...rest} />
    </View>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = value === option;
        return (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <Text style={styles.toggleText}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

function KeyStatus({ configured, value }: { configured: boolean; value?: string }) {
  const hasKey = configured || Boolean(value?.trim());
  return (
    <View style={styles.keyStatus}>
      <Ionicons name={hasKey ? "checkmark-circle" : "alert-circle-outline"} size={15} color={hasKey ? colors.green : colors.muted} />
      <Text style={[styles.keyStatusText, hasKey && styles.keyStatusConfigured]}>
        {hasKey ? "API key configured" : "API key not set"}
      </Text>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusRow({ label, value, icon, onPress }: { label: string; value: string; icon: ComponentProps<typeof Ionicons>["name"]; onPress?: () => void }) {
  const content = (
    <>
      <View style={styles.statusIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue} numberOfLines={1}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.statusRow}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.statusRow}>{content}</View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    ...shadow,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.card,
    padding: 12,
    alignItems: "center",
    ...shadow,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    borderRadius: 18,
    backgroundColor: "#f2f0fa",
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabActive: {
    backgroundColor: colors.card,
    ...shadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
  },
  tabTextActive: {
    color: colors.primary,
  },
  formCard: {
    gap: 12,
  },
  dashboardCard: {
    gap: 12,
  },
  dashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metric: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: "#fafafe",
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    justifyContent: "center",
    gap: 4,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusPill: {
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.greenLight,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusPillWarn: {
    backgroundColor: colors.orangeLight,
  },
  statusPillText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: "900",
  },
  statusPillTextWarn: {
    color: colors.orange,
  },
  statusRow: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#fafafe",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  smallAction: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  smallActionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  inputWrap: {
    gap: 5,
  },
  filterBlock: {
    gap: 6,
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fafafe",
    paddingHorizontal: 12,
    color: colors.text,
  },
  segmented: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  segment: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafe",
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: colors.primary,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  userCard: {
    gap: 12,
  },
  userTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: "900",
  },
  userName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.redLight,
  },
  inlineControls: {
    gap: 8,
  },
  providerSection: {
    gap: 8,
    paddingTop: 4,
  },
  toggleRow: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#fafafe",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleText: {
    flex: 1,
    color: colors.text,
    fontWeight: "800",
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d7d9e8",
    padding: 3,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  keyStatus: {
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: "#fafafe",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  keyStatusText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  keyStatusConfigured: {
    color: colors.green,
  },
  logRow: {
    gap: 4,
    borderRadius: 14,
    backgroundColor: "#fafafe",
    padding: 12,
  },
  logMeta: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  logMessage: {
    color: colors.text,
    fontWeight: "700",
  },
});
