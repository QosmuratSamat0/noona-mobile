import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useAudioStore } from '../store/audioStore';
import { HoldToSpeak } from '../components/HoldToSpeak';
import { CorrectionBlockComponent } from '../components/CorrectionBlock';
import api from '../lib/axios';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const Chat = () => {
  const { refreshToken, logout: clearStore, user } = useAuthStore();
  const correction = useAudioStore((s) => s.correction);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm Noona, your AI language coach. Hold the button below to speak, and I'll help correct your grammar and pronunciation. 🎙️",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-add correction as an assistant message
  useEffect(() => {
    if (correction?.transcript) {
      const parts: string[] = [];
      if (correction.grammar) {
        parts.push(`📝 **Grammar:** "${correction.grammar.original}" → "${correction.grammar.corrected}"`);
      }
      if (correction.pronunciation) {
        parts.push(`🔊 **Pronunciation:** "${correction.pronunciation.original}" → /${correction.pronunciation.phonetic}/`);
      }
      if (parts.length > 0) {
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: parts.join('\n'),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, msg]);
      }
    }
  }, [correction]);

  const handleLogout = async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch {}
    clearStore();
  };

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    // TODO: integrate with /chat/message endpoint
    setTimeout(() => {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I received your message! Connect the backend `/chat/message` endpoint to get real AI responses.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsSending(false);
    }, 800);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-root">
      {/* Animated background blobs */}
      <div className="chat-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* Layout */}
      <div className="chat-layout">
        {/* ── Sidebar ─────────────────────────────── */}
        <aside className="chat-sidebar glass">
          <div className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Noona AI</span>
          </div>

          <nav className="sidebar-nav">
            <a href="/chat" className="sidebar-link sidebar-link--active">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat
            </a>
            <a href="/dashboard" className="sidebar-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Dashboard
            </a>
            <a href="/profile" className="sidebar-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </a>
          </nav>

          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.email?.[0]?.toUpperCase() ?? 'U'}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-email">{user?.email ?? 'User'}</span>
              <button className="sidebar-logout" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        </aside>

        {/* ── Main area ────────────────────────────── */}
        <main className="chat-main">
          {/* Header */}
          <header className="chat-header glass">
            <div className="chat-header-info">
              <div className="chat-avatar-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
                  <path d="M19 10a7 7 0 0 1-14 0" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <div>
                <p className="chat-header-title">Noona</p>
                <p className="chat-header-sub">AI Language Coach · Online</p>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="chat-messages">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`chat-bubble-row${msg.role === 'user' ? ' chat-bubble-row--user' : ''}`}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {msg.role === 'assistant' && (
                    <div className="chat-bubble-avatar">N</div>
                  )}
                  <div className={`chat-bubble glass${msg.role === 'user' ? ' chat-bubble--user' : ''}`}>
                    <p className="chat-bubble-text">{msg.content}</p>
                    <span className="chat-bubble-time">{formatTime(msg.timestamp)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* AI typing indicator */}
            <AnimatePresence>
              {isSending && (
                <motion.div
                  className="chat-bubble-row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="chat-bubble-avatar">N</div>
                  <div className="chat-bubble glass chat-bubble--typing">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="typing-dot"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Correction block */}
          <div className="chat-correction-area">
            <CorrectionBlockComponent />
          </div>

          {/* Input area */}
          <div className="chat-input-area glass">
            {/* Hold to Speak button */}
            <HoldToSpeak />

            <div className="chat-divider">
              <span>or type</span>
            </div>

            {/* Text input */}
            <div className="chat-text-row">
              <input
                id="chat-text-input"
                className="chat-text-input glass"
                type="text"
                placeholder="Type a message…"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <motion.button
                id="chat-send-btn"
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={!inputText.trim() || isSending}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </motion.button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
