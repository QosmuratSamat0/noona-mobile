import { API_URL } from '../config/api';

const REQUEST_TIMEOUT_MS = 12000;

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
    return parseResponse<T>(res, path);
  } catch (error) {
    throw formatNetworkError(error, path);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return parseResponse<T>(res, path);
  } catch (error) {
    throw formatNetworkError(error, path);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function withNetworkTimeout<T>(request: Promise<T>, path: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out: ${path}. Check backend URL: ${API_URL}`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function parseResponse<T>(res: Response, path = 'request'): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const error = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : undefined;
    throw new Error(error || `Request failed with ${res.status}: ${path}`);
  }
  return data as T;
}

function formatNetworkError(error: unknown, path: string) {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Error(`Request timed out: ${path}. Check backend URL: ${API_URL}`);
  }
  if (error instanceof Error) {
    return new Error(`${error.message}. Check backend URL: ${API_URL}`);
  }
  return new Error(`Network error: ${path}. Check backend URL: ${API_URL}`);
}
