import { apiGet, apiPost } from '../../shared/api/http';

export type SessionDto = {
  id: string;
  user_id: string;
  created_at: string;
};

export type MessageDto = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'coach' | 'ai';
  content: string;
  created_at: string;
};

export function getSessions(token: string) {
  return apiGet<SessionDto[]>('/sessions/', token);
}

export function createSession(token: string) {
  return apiPost<SessionDto>('/sessions/', {}, token);
}

export function getSessionMessages(sessionId: string, token: string) {
  return apiGet<MessageDto[]>(`/sessions/${sessionId}/messages`, token);
}

export function sendMessage(sessionId: string, content: string, token: string) {
  return apiPost<MessageDto>(`/sessions/${sessionId}/messages`, { content }, token);
}
