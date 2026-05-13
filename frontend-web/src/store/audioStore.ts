import { create } from 'zustand';

export type AudioStatus = 'idle' | 'recording' | 'uploading' | 'processing';

export interface CorrectionBlock {
  grammar?: { original: string; corrected: string };
  pronunciation?: { original: string; phonetic: string };
  transcript?: string;
}

interface AudioState {
  status: AudioStatus;
  jobId: string | null;
  correction: CorrectionBlock | null;
  recordingSeconds: number;

  setStatus: (status: AudioStatus) => void;
  setJobId: (jobId: string | null) => void;
  setCorrection: (correction: CorrectionBlock | null) => void;
  tickTimer: () => void;
  resetTimer: () => void;
  reset: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  status: 'idle',
  jobId: null,
  correction: null,
  recordingSeconds: 0,

  setStatus: (status) => set({ status }),
  setJobId: (jobId) => set({ jobId }),
  setCorrection: (correction) => set({ correction }),
  tickTimer: () => set((s) => ({ recordingSeconds: s.recordingSeconds + 1 })),
  resetTimer: () => set({ recordingSeconds: 0 }),
  reset: () => set({ status: 'idle', jobId: null, recordingSeconds: 0 }),
}));
