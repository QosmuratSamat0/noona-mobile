import { API_URL } from '../config/api';

export function makeWsUrl(token: string) {
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws/chat`;
  url.searchParams.set('token', token);
  return url.toString();
}
