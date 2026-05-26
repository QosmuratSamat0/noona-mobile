import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';

export function Metric({ value, label, accent }: { value: string; label: string; accent?: 'flame' }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {accent && <Ionicons name="flame-outline" size={18} color="#f5a623" />}
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function HeatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.heatRow}>
      <Text style={styles.heatLabel}>{label}</Text>
      <View style={styles.heatTrack}>
        <View style={[styles.heatFill, { width: `${value * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.heatValue}>{Math.round(value * 100)}%</Text>
    </View>
  );
}
