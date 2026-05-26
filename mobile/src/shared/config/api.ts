import { Platform } from 'react-native';

const DEFAULT_HOST = Platform.select({
  android: '10.0.2.2',
  default: 'localhost',
});

const normalizeApiUrl = (url: string) => url.replace(/\/$/, '');

export const API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL ?? `http://${DEFAULT_HOST}:8080/api/v1`,
);
