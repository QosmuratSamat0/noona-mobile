import { useState, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

// Module-level variables to track the active recording and start promise across hook instances
let activeRecording: Audio.Recording | null = null;
let startRecordingPromise: Promise<Audio.Recording | null> | null = null;

export const useAudio = () => {
  const [recording, setRecordingState] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync state with global activeRecording on mount
  useEffect(() => {
    setRecordingState(activeRecording);
  }, []);

  const startRecording = useCallback(async () => {
    // If already starting, do not initiate another start
    if (startRecordingPromise) return;

    try {
      setIsRecording(true);
      
      startRecordingPromise = (async () => {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          console.error('Microphone permission not granted');
          return null;
        }

        // Clean up any previous recording that might still be active
        if (activeRecording) {
          try {
            await activeRecording.stopAndUnloadAsync();
          } catch (_) {}
          activeRecording = null;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        
        activeRecording = newRecording;
        return newRecording;
      })();

      const rec = await startRecordingPromise;
      setRecordingState(rec);
      if (!rec) {
        setIsRecording(false);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    } finally {
      startRecordingPromise = null;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    let rec = activeRecording;

    // If a recording is currently starting, wait for it to finish first
    const promise = startRecordingPromise;
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
      setRecordingState(null);
      activeRecording = null;

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

  const playAudio = useCallback(async (uri: string) => {
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

  return { 
    isRecording, 
    isPlaying, 
    startRecording, 
    stopRecording, 
    playAudio 
  };
};
