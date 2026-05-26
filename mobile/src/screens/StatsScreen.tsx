import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getActivity, getMistakes, type ActivityDto, type MistakeDto } from '../features/stats/api';
import { colors } from '../shared/theme/colors';
import { styles } from '../shared/ui/styles';

export function StatsScreen({ token }: { token: string }) {
  const [mistakes, setMistakes] = useState<MistakeDto[]>([]);
  const [activity, setActivity] = useState<ActivityDto | null>(null);

  useEffect(() => {
    void Promise.all([
      getMistakes(token).then((items) => setMistakes(Array.isArray(items) ? items : [])).catch(() => setMistakes([])),
      getActivity(token).then(setActivity).catch(() => setActivity(null)),
    ]);
  }, [token]);

  const week = normalizeWeek(Array.isArray(activity?.daily_stats) ? activity.daily_stats : []);
  const max = Math.max(1, ...week.map((item) => item.count));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{mistakes.length} mistakes</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current level</Text>
          <Text style={styles.metricValue}>A2</Text>
          <View style={styles.heatTrack}>
            <View style={[styles.heatFill, { width: '62%', backgroundColor: colors.green }]} />
          </View>
          <Text style={styles.subText}>62% to B1</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sessions - last 7 days</Text>
          <View style={{ height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            {week.map((item) => (
              <View key={item.label} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: '100%',
                    height: `${Math.max(8, (item.count / max) * 100)}%`,
                    borderRadius: 8,
                    backgroundColor: colors.green,
                  }}
                />
                <Text style={styles.muted}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Recent corrections</Text>
          {mistakes.length === 0 ? (
            <Text style={styles.subText}>Practice from chat to collect corrections here.</Text>
          ) : (
            mistakes.slice(0, 8).map((mistake) => (
              <View key={mistake.id} style={styles.statRow}>
                <Text style={styles.muted}>{mistake.type}</Text>
                <Text style={styles.statText}>
                  <Text style={styles.strike}>{mistake.original}</Text>
                  {'  ->  '}
                  <Text style={styles.greenText}>{mistake.corrected}</Text>
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function normalizeWeek(stats: NonNullable<ActivityDto['daily_stats']>) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  if (stats.length === 0) {
    return [0, 0, 0, 0, 0, 0, 0].map((count, index) => ({ label: labels[index] ?? '', count }));
  }
  return stats.slice(-7).map((item, index) => ({
    label: labels[index] ?? '',
    count: item.session_count,
  }));
}
