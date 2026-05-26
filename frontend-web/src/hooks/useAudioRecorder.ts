import { useRef, useCallback, useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { setStatus, setJobId, setCorrection, tickTimer, resetTimer, status } = useAudioStore();
  const accessToken = useAuthStore((s) => s.accessToken);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
    const wsUrl = new URL(apiBase);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl.pathname = `${wsUrl.pathname.replace(/\/$/, '')}/ws/chat`;
    wsUrl.searchParams.set('token', accessToken);

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onmessage = (event) => {
      String(event.data)
        .split('\n')
        .filter(Boolean)
        .forEach((payload) => {
          try {
            const message = JSON.parse(payload);
            if (message.type !== 'audio_processing_result') return;

            const data = message.data ?? {};
            const analysis = data.analysis ?? {};
            setCorrection({
              transcript: data.transcript,
              grammar: analysis.correction
                ? { original: data.transcript, corrected: analysis.correction }
                : undefined,
            });
            setStatus('idle');
          } catch (err) {
            console.error('Failed to parse websocket message:', err);
          }
        });
    };

    ws.onerror = (err) => {
      console.error('Audio websocket error:', err);
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [accessToken, setCorrection, setStatus]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    if (status === 'recording') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        await uploadAudio(blob);
      };

      recorder.start(100); // collect data every 100ms
      setStatus('recording');
      resetTimer();

      timerRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setStatus('idle');
    }
  }, [status, setStatus, resetTimer, tickTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('uploading');
    }
  }, [setStatus]);

  const uploadAudio = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');

      const res = await api.post<{ job_id: string }>('/audio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { job_id } = res.data;
      setJobId(job_id);
      setStatus('processing');
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('idle');
    }
  };

  return { startRecording, stopRecording };
}
