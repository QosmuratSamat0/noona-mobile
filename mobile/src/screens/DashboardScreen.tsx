import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { User } from '../entities/auth/model';
import { getSessions } from '../features/chat/api';
import { getActivity, getMistakes, type ActivityDto, type MistakeDto } from '../features/stats/api';
import { capitalize } from '../shared/lib/text';
import { colors } from '../shared/theme/colors';
import { HeatRow, Metric } from '../shared/ui/DashboardWidgets';
import { styles } from '../shared/ui/styles';

export function DashboardScreen({ token, user, onPractice }: { token: string; user: User; onPractice: () => void }) {
  const [activity, setActivity] = useState<ActivityDto | null>(null);
  const [mistakes, setMistakes] = useState<MistakeDto[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const firstName = user.name?.split(' ')[0] || user.email.split('@')[0] || 'friend';
  const safeMistakes = Array.isArray(mistakes) ? mistakes : [];
  const topMistakes = useMemo(() => summarizeMistakes(safeMistakes), [safeMistakes]);

  useEffect(() => {
    void Promise.all([
      getActivity(token).then(setActivity).catch(() => setActivity(null)),
      getMistakes(token).then((items) => setMistakes(Array.isArray(items) ? items : [])).catch(() => setMistakes([])),
      getSessions(token).then((sessions) => setSessionCount(Array.isArray(sessions) ? sessions.length : 0)).catch(() => setSessionCount(0)),
    ]);
  }, [token]);

  const streak = activity?.streak?.current_streak ?? 0;
  const cefr = user.role === 'admin' ? 'Admin' : 'A2';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mini-Loora</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{cefr} level</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hello}>Hey, {capitalize(firstName)}!</Text>
        <Text style={styles.subText}>{streak > 0 ? `${streak} day streak - keep going` : 'Ready to practice?'}</Text>

        <View style={styles.metricGrid}>
          <Metric value={String(streak)} label="Day streak" accent="flame" />
          <Metric value={String(sessionCount)} label="Sessions total" />
          <Metric value={String(safeMistakes.length)} label="Corrections" />
          <Metric value={cefr} label="CEFR level" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Grammar heatmap</Text>
          {topMistakes.length === 0 ? (
            <>
              <HeatRow label="Past tense" value={0.78} color={colors.red} />
              <HeatRow label="Articles" value={0.52} color={colors.orange} />
              <HeatRow label="Prepositions" value={0.38} color={colors.success} />
            </>
          ) : (
            topMistakes.map((item) => (
              <HeatRow key={item.label} label={item.label} value={item.value} color={item.color} />
            ))
          )}
        </View>

        <Pressable style={styles.primaryButton} onPress={onPractice}>
          <Ionicons name="mic-outline" size={20} color={colors.white} />
          <Text style={styles.primaryButtonText}>Start practice</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function summarizeMistakes(mistakes: MistakeDto[]) {
  const counts = mistakes.reduce<Record<string, number>>((acc, mistake) => {
    const key = mistake.type || 'Grammar';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const total = Math.max(1, mistakes.length);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count], index) => ({
      label,
      value: count / total,
      color: [colors.red, colors.orange, colors.green, colors.success][index] ?? colors.green,
    }));
}
