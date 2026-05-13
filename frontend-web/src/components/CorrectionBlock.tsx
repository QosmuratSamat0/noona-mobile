import { motion, AnimatePresence } from 'framer-motion';
import { useAudioStore, type CorrectionBlock } from '../store/audioStore';
import './CorrectionBlock.css';

const TokenDiff = ({ original, corrected }: { original: string; corrected: string }) => (
  <div className="cb-token-diff">
    <span className="cb-token cb-token--wrong">{original}</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cb-arrow">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
    <span className="cb-token cb-token--correct">{corrected}</span>
  </div>
);

const PhoneticRow = ({ original, phonetic }: { original: string; phonetic: string }) => (
  <div className="cb-phonetic-row">
    <span className="cb-phonetic-word">{original}</span>
    <span className="cb-phonetic-badge">{phonetic}</span>
  </div>
);

export const CorrectionBlockComponent = () => {
  const correction = useAudioStore((s) => s.correction);

  return (
    <AnimatePresence>
      {correction && (
        <motion.div
          className="cb-card"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Header */}
          <div className="cb-header">
            <span className="cb-badge">AI Feedback</span>
            <button
              className="cb-close"
              onClick={() => useAudioStore.getState().setCorrection(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>

          {/* Transcript */}
          {correction.transcript && (
            <div className="cb-section">
              <p className="cb-section-label">You said</p>
              <p className="cb-transcript">"{correction.transcript}"</p>
            </div>
          )}

          {/* Grammar correction */}
          {correction.grammar && (
            <div className="cb-section">
              <p className="cb-section-label">
                <span className="cb-dot cb-dot--grammar" /> Grammar
              </p>
              <TokenDiff
                original={correction.grammar.original}
                corrected={correction.grammar.corrected}
              />
            </div>
          )}

          {/* Pronunciation correction */}
          {correction.pronunciation && (
            <div className="cb-section">
              <p className="cb-section-label">
                <span className="cb-dot cb-dot--pronunciation" /> Pronunciation
              </p>
              <PhoneticRow
                original={correction.pronunciation.original}
                phonetic={correction.pronunciation.phonetic}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
