import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper functions for auth token management
export const setTokens = async (accessToken: string, refreshToken: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  } else {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
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

export const removeToken = async () => {
  await removeTokens();
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

// Add a response interceptor to handle 401 globally with auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          const res = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          if (res.data?.access_token && res.data?.refresh_token) {
            await setTokens(res.data.access_token, res.data.refresh_token);
            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error("Failed to refresh token", refreshError);
      }
      await removeTokens();
    }
    return Promise.reject(error);
  }
);
