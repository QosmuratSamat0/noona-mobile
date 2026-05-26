import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from '../../entities/auth/model';

const tokenKey = 'tokens';

export async function saveTokens(tokens: AuthTokens) {
  await AsyncStorage.setItem(tokenKey, JSON.stringify(tokens));
}

export async function loadTokens() {
  const saved = await AsyncStorage.getItem(tokenKey);
  return saved ? (JSON.parse(saved) as AuthTokens) : null;
}

export async function clearTokens() {
  await AsyncStorage.removeItem(tokenKey);
}
