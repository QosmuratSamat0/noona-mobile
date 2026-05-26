import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { User } from '../entities/auth/model';
import { styles } from '../shared/ui/styles';

export function ProfileScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.panel}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{(user.email[0] ?? 'U').toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{user.name || 'Mini-Loora learner'}</Text>
          <Text style={styles.subText}>{user.email}</Text>
        </View>
        <Pressable style={styles.outlineButton} onPress={onLogout}>
          <Text style={styles.outlineButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
