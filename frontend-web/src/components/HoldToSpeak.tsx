import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioStore } from '../store/audioStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import './HoldToSpeak.css';

// Animated waveform bars shown during recording
const WaveformBars = () => (
  <div className="waveform">
    {[...Array(7)].map((_, i) => (
      <motion.span
        key={i}
        className="waveform-bar"
        animate={{ scaleY: [0.3, 1, 0.3] }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: i * 0.1,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

// Apple-style spinner
const Spinner = () => (
  <motion.div
    className="spinner"
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
  />
);

export const HoldToSpeak = () => {
  const { status, recordingSeconds } = useAudioStore();
  const { startRecording, stopRecording } = useAudioRecorder();
  const isHeld = useRef(false);

  const handleStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (status !== 'idle') return;
    isHeld.current = true;
    await startRecording();
  }, [status, startRecording]);

  const handleEnd = useCallback(() => {
    if (!isHeld.current) return;
    isHeld.current = false;
    stopRecording();
  }, [stopRecording]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isUploading = status === 'uploading';
  const isActive = isRecording || isUploading || isProcessing;

  const labelMap: Record<typeof status, string> = {
    idle: 'Hold to Speak',
    recording: formatTime(recordingSeconds),
    uploading: 'Uploading…',
    processing: 'Processing…',
  };

  return (
    <div className="hts-wrapper">
      {/* Outer glow ring */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            className="hts-glow-ring"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        id="hold-to-speak-btn"
        className={`hts-btn${isRecording ? ' hts-btn--recording' : ''}${isActive ? ' hts-btn--active' : ''}`}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        disabled={isUploading || isProcessing}
        whileTap={{ scale: 0.93 }}
        animate={
          isRecording
            ? { boxShadow: ['0 0 0px 0px rgba(99,102,241,0)', '0 0 30px 10px rgba(99,102,241,0.45)', '0 0 0px 0px rgba(99,102,241,0)'] }
            : {}
        }
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Mic icon (idle / uploading) */}
        <AnimatePresence mode="wait">
          {!isRecording && !isProcessing && (
            <motion.div
              key="mic"
              className="hts-icon"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: isUploading ? 0.5 : 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
                <path d="M19 10a7 7 0 0 1-14 0" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </motion.div>
          )}

          {/* Waveform (recording) */}
          {isRecording && (
            <motion.div
              key="wave"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <WaveformBars />
            </motion.div>
          )}

          {/* Spinner (processing) */}
          {isProcessing && (
            <motion.div
              key="spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Spinner />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={status}
          className="hts-label"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {labelMap[status]}
        </motion.p>
      </AnimatePresence>

      {/* Uploading progress bar */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            className="hts-progress-track"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="hts-progress-bar"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
