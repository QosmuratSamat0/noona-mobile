import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Text, View } from 'react-native';
import { shorten } from '../lib/text';
import { colors } from '../theme/colors';
import { styles } from './styles';

export function PlayRow() {
  return (
    <View style={styles.playRow}>
      <Ionicons name="play-outline" size={16} color={colors.muted} />
      <Text style={styles.playText}>play</Text>
    </View>
  );
}

export function CorrectionCard({ correction }: { correction: { from: string; to: string; note: string } }) {
  return (
    <View style={styles.correctionCard}>
      <Text style={styles.correctionTitle}>CORRECTION</Text>
      <Text style={styles.correctionLine}>
        <Text style={styles.strike}>{shorten(correction.from)}</Text>
        {'  ->  '}
        <Text style={styles.greenText}>{shorten(correction.to)}</Text>
      </Text>
      <Text style={styles.correctionNote}>{correction.note}</Text>
    </View>
  );
}
