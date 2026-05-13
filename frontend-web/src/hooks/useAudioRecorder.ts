import { useRef, useCallback, useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import api from '../lib/axios';

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { setStatus, setJobId, setCorrection, tickTimer, resetTimer, status } = useAudioStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
      formData.append('audio', blob, 'recording.webm');

      const res = await api.post<{ job_id: string }>('/audio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { job_id } = res.data;
      setJobId(job_id);
      setStatus('processing');
      pollJobStatus(job_id);
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('idle');
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await api.get<{
          status: string;
          result?: {
            transcript?: string;
            grammar?: { original: string; corrected: string };
            pronunciation?: { original: string; phonetic: string };
          };
        }>(`/audio/status/${jobId}`);

        const { status: jobStatus, result } = res.data;

        if (jobStatus === 'done' && result) {
          setCorrection({
            transcript: result.transcript,
            grammar: result.grammar,
            pronunciation: result.pronunciation,
          });
          setStatus('idle');
          return;
        }

        if (jobStatus === 'failed' || attempts >= maxAttempts) {
          setStatus('idle');
          return;
        }

        attempts++;
        setTimeout(poll, 2000);
      } catch {
        setStatus('idle');
      }
    };

    poll();
  };

  return { startRecording, stopRecording };
}
