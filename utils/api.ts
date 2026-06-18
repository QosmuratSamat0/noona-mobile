import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper functions for auth token management
export const setTokens = async (accessToken: string, refreshToken: string) => {
  accessToken = accessToken.trim();
  refreshToken = refreshToken.trim();

  if (Platform.OS === 'web') {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
  } else {
    if (accessToken) {
      await SecureStore.setItemAsync('accessToken', accessToken);
    }
    if (refreshToken) {
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    }
  }
};

export const getAccessToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('accessToken');
  }
  return await SecureStore.getItemAsync('accessToken');
};

export const getRefreshToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('refreshToken');
  }
  return await SecureStore.getItemAsync('refreshToken');
};

export const removeTokens = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } else {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  }
};

// Backward compatibility with older code referencing userToken
export const setToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem('accessToken', token);
  } else {
    await SecureStore.setItemAsync('accessToken', token);
  }
};

export const getToken = async () => {
  return await getAccessToken();
};

export const isUnauthorizedError = (error: unknown) => {
  return axios.isAxiosError(error) && error.response?.status === 401;
};

export const removeToken = async () => {
  await removeTokens();
};

export const refreshTokens = async () => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const res = await axios.post(`${API_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });

  const accessToken = res.data?.access_token;
  const nextRefreshToken = res.data?.refresh_token;
  if (!accessToken) {
    return null;
  }

  await setTokens(accessToken, nextRefreshToken || refreshToken);
  return accessToken;
};

export const getValidToken = async () => {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  try {
    await api.get('/users/me');
    return token;
  } catch {
    try {
      return await refreshTokens();
    } catch (refreshError) {
      await removeTokens();
      return null;
    }
  }
};

// Add a request interceptor to attach the token
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle stale/expired tokens with one auto-refresh.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    if ((status === 401 || status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const accessToken = await refreshTokens();
        if (accessToken) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Expired/invalid refresh tokens are an expected app-resume case.
      }
      await removeTokens();
    }
    return Promise.reject(error);
  }
);
