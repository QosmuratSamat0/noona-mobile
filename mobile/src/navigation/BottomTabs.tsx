import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Tab } from '../entities/chat/model';
import { colors } from '../shared/theme/colors';
import { styles } from '../shared/ui/styles';

export function BottomTabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    { key: 'home', label: 'Home', icon: 'home-outline' },
    { key: 'chat', label: 'Chat', icon: 'chatbubble-ellipses-outline' },
    { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
  ];

  return (
    <View style={styles.tabs}>
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <Pressable key={item.key} style={styles.tabItem} onPress={() => onChange(item.key)}>
            <Ionicons name={item.icon} size={22} color={selected ? colors.green : colors.muted} />
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
