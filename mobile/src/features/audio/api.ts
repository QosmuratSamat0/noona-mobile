import { API_URL } from '../../shared/config/api';
import { parseResponse, withNetworkTimeout } from '../../shared/api/http';

export async function uploadAudio(uri: string, token: string) {
  const form = new FormData();
  form.append('file', {
    uri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);

  const res = await withNetworkTimeout(
    fetch(`${API_URL}/audio/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }),
    '/audio/upload',
    30000,
  );

  return parseResponse<{ job_id: string }>(res, '/audio/upload');
}
