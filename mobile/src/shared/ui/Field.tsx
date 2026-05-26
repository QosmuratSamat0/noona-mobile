import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { styles } from './styles';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
};

export function Field(props: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}
