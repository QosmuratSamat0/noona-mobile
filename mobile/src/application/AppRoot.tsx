import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { AuthTokens, User } from '../entities/auth/model';
import { getCurrentUser, logout } from '../features/auth/api';
import { clearTokens, loadTokens, saveTokens } from '../features/auth/sessionStorage';
import { RootNavigator } from '../navigation/RootNavigator';
import { LoginScreen } from '../screens/LoginScreen';
import { colors } from '../shared/theme/colors';
import { Shell } from '../shared/ui/Shell';
import { styles } from '../shared/ui/styles';
import { ErrorBoundary } from './ErrorBoundary';

export function AppRoot() {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const savedTokens = await loadTokens();
      if (!savedTokens) return;
      setTokens(savedTokens);
      setUser(await getCurrentUser(savedTokens.access_token));
    } catch {
      await clearTokens();
    } finally {
      setBooting(false);
    }
  };

  const handleLogin = async (nextTokens: AuthTokens, nextUser: User) => {
    setTokens(nextTokens);
    setUser(nextUser);
    await saveTokens(nextTokens);
  };

  const handleLogout = async () => {
    if (tokens?.refresh_token) {
      void logout(tokens.refresh_token, tokens.access_token);
    }
    setTokens(null);
    setUser(null);
    await clearTokens();
  };

  if (booting) {
    return (
      <Shell>
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      </Shell>
    );
  }

  if (!tokens || !user) {
    return (
      <ErrorBoundary>
        <LoginScreen onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Shell>
        <RootNavigator tokens={tokens} user={user} onLogout={handleLogout} />
      </Shell>
    </ErrorBoundary>
  );
}
