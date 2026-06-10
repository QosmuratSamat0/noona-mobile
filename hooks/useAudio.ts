import { useState, useCallback } from 'react';
import { Audio } from 'expo-av';

export const useAudio = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        console.error('Microphone permission not granted');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recording) return null;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = recording.getURI();
      setRecording(null);
      return uri;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return null;
    }
  }, [recording]);

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
