import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import type { AuthTokens, User } from '../entities/auth/model';
import { getCurrentUser, login } from '../features/auth/api';
import { getErrorMessage } from '../shared/lib/errors';
import { colors } from '../shared/theme/colors';
import { Field } from '../shared/ui/Field';
import { Shell } from '../shared/ui/Shell';
import { styles } from '../shared/ui/styles';

export function LoginScreen({ onLogin }: { onLogin: (tokens: AuthTokens, user: User) => Promise<void> }) {
  const [email, setEmail] = useState('alikhan@gmail.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }

    setLoading(true);
    try {
      const tokens = await login(email, password);
      const profile = await getCurrentUser(tokens.access_token);
      await onLogin(tokens, profile);
    } catch (error) {
      Alert.alert('Login failed', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginWrap}>
        <View style={styles.loginCard}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandTitle}>Mini-Loora</Text>
            <Text style={styles.brandSubtitle}>AI English Speaking Coach</Text>
          </View>

          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />

          <Pressable style={styles.forgotBtn}>
            <Text style={styles.greenText}>Forgot password?</Text>
          </Pressable>

          <Pressable style={[styles.outlineButton, loading && styles.disabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.outlineButtonText}>Sign in</Text>}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.line} />
            <Text style={styles.muted}>or</Text>
            <View style={styles.line} />
          </View>

          <Pressable style={styles.googleButton}>
            <Text style={styles.googleLetter}>G</Text>
            <Text style={styles.googleText}>Continue with{'\n'}Google</Text>
          </Pressable>

          <Text style={styles.createText}>
            No account? <Text style={styles.greenText}>Create one</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Shell>
  );
}
