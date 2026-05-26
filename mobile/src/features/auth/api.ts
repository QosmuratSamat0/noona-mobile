import type { AuthTokens, User } from '../../entities/auth/model';
import { apiGet, apiPost } from '../../shared/api/http';

export function login(email: string, password: string) {
  return apiPost<AuthTokens>('/auth/login', { email, password });
}

export function getCurrentUser(token: string) {
  return apiGet<User>('/users/me', token);
}

export function logout(refreshToken: string, accessToken?: string) {
  return apiPost('/auth/logout', { refresh_token: refreshToken }, accessToken);
}
