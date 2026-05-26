import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView } from 'react-native';
import { styles } from './styles';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="light" />
      {children}
    </SafeAreaView>
  );
}
