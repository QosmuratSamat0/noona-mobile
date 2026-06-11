import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// ─── Web-specific recording using native MediaRecorder API ───
// expo-av Audio.Recording is experimental on web and often fails silently.
// We use the browser's MediaRecorder directly for reliable recording.

type WebRecordingState = {
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
  stream: MediaStream;
};

export const useAudio = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Native refs (expo-av)
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const startRecordingPromiseRef = useRef<Promise<Audio.Recording | null> | null>(null);

  // Web refs (MediaRecorder)
  const webRecordingRef = useRef<WebRecordingState | null>(null);
  const webStartPromiseRef = useRef<Promise<boolean> | null>(null);

  // Web audio playback ref
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') {
        const wr = webRecordingRef.current;
        if (wr) {
          try { wr.mediaRecorder.stop(); } catch (_) {}
          wr.stream.getTracks().forEach(t => t.stop());
          webRecordingRef.current = null;
        }
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          webAudioRef.current = null;
        }
      } else {
        const rec = activeRecordingRef.current;
        if (rec) {
          rec.stopAndUnloadAsync().catch(() => {});
        }
      }
    };
  }, []);

  // ─── START RECORDING ───

  const startRecordingWeb = useCallback(async () => {
    if (webStartPromiseRef.current) return;

    try {
      setIsRecording(true);

      webStartPromiseRef.current = (async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Pick the best supported MIME type
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
          .find(t => MediaRecorder.isTypeSupported(t)) || '';

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        webRecordingRef.current = { mediaRecorder, chunks, stream };
        mediaRecorder.start(100); // collect data in 100ms chunks
        console.log('Web recording started', mimeType || 'default mime');
        return true;
      })();

      const ok = await webStartPromiseRef.current;
      if (!ok) setIsRecording(false);
    } catch (err) {
      console.error('Failed to start web recording', err);
      setIsRecording(false);
    } finally {
      webStartPromiseRef.current = null;
    }
  }, []);

  const startRecordingNative = useCallback(async () => {
    if (startRecordingPromiseRef.current) return;

    try {
      setIsRecording(true);

      startRecordingPromiseRef.current = (async () => {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          console.error('Microphone permission not granted');
          return null;
        }

        // Clean up any previous recording that might still be active
        if (activeRecordingRef.current) {
          try {
            await activeRecordingRef.current.stopAndUnloadAsync();
          } catch (_) {}
          activeRecordingRef.current = null;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        activeRecordingRef.current = newRecording;
        return newRecording;
      })();

      const rec = await startRecordingPromiseRef.current;
      if (!rec || activeRecordingRef.current === null) {
        setIsRecording(false);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    } finally {
      startRecordingPromiseRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      await startRecordingWeb();
    } else {
      await startRecordingNative();
    }
  }, [startRecordingWeb, startRecordingNative]);

  // ─── STOP RECORDING ───

  const stopRecordingWeb = useCallback(async (): Promise<string | null> => {
    // Wait for start to complete if still in progress
    const promise = webStartPromiseRef.current;
    if (promise) {
      try { await promise; } catch (_) {}
    }

    const wr = webRecordingRef.current;
    if (!wr) {
      setIsRecording(false);
      return null;
    }

    return new Promise<string | null>((resolve) => {
      const { mediaRecorder, chunks, stream } = wr;

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        webRecordingRef.current = null;
        stream.getTracks().forEach(t => t.stop());

        if (chunks.length === 0) {
          console.error('No audio chunks recorded');
          resolve(null);
          return;
        }

        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const uri = URL.createObjectURL(blob);
        console.log('Web recording stopped, blob size:', blob.size, 'type:', blob.type);
        resolve(uri);
      };

      try {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        } else {
          setIsRecording(false);
          webRecordingRef.current = null;
          stream.getTracks().forEach(t => t.stop());
          resolve(null);
        }
      } catch (err) {
        console.error('Failed to stop web recording', err);
        setIsRecording(false);
        webRecordingRef.current = null;
        stream.getTracks().forEach(t => t.stop());
        resolve(null);
      }
    });
  }, []);

  const stopRecordingNative = useCallback(async (): Promise<string | null> => {
    let rec = activeRecordingRef.current;

    const promise = startRecordingPromiseRef.current;
    if (promise) {
      try {
        rec = await promise;
      } catch (err) {
        console.error('Error waiting for recording to start', err);
      }
    }

    if (!rec) {
      setIsRecording(false);
      return null;
    }

    try {
      setIsRecording(false);
      activeRecordingRef.current = null;

      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = rec.getURI();
      return uri;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return null;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return stopRecordingWeb();
    } else {
      return stopRecordingNative();
    }
  }, [stopRecordingWeb, stopRecordingNative]);

  // ─── PLAY AUDIO ───

  const playAudioWeb = useCallback(async (uri: string) => {
    try {
      setIsPlaying(true);

      // Clean up previous audio element
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }

      const audio = new window.Audio(uri);
      webAudioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        webAudioRef.current = null;
      };

      audio.onerror = () => {
        console.error('Web audio playback error');
        setIsPlaying(false);
        webAudioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error('Failed to play audio on web', err);
      setIsPlaying(false);
    }
  }, []);

  const playAudioNative = useCallback(async (uri: string) => {
    try {
      setIsPlaying(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
        }
      });
    } catch (err) {
      console.error('Failed to play audio', err);
      setIsPlaying(false);
    }
  }, []);

  const playAudio = useCallback(async (uri: string) => {
    if (Platform.OS === 'web') {
      await playAudioWeb(uri);
    } else {
      await playAudioNative(uri);
    }
  }, [playAudioWeb, playAudioNative]);

  return {
    isRecording,
    isPlaying,
    startRecording,
    stopRecording,
    playAudio
  };
};
