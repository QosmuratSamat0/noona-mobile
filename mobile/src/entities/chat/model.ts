export type Tab = 'home' | 'chat' | 'stats' | 'profile';

export type Correction = {
  transcript: string;
  corrected?: string;
  explanation?: string;
  audioUrl?: string;
};

export type ChatMessage = {
  id: string;
  role: 'coach' | 'user';
  text: string;
  correction?: { from: string; to: string; note: string };
};

export const initialMessages: ChatMessage[] = [
  {
    id: 'coach-1',
    role: 'coach',
    text: 'Hey! What did you do last weekend?',
  },
  {
    id: 'user-1',
    role: 'user',
    text: 'I goed to cinema with friend.',
    correction: { from: 'goed', to: 'went', note: 'go -> went, irregular verb' },
  },
  {
    id: 'coach-2',
    role: 'coach',
    text: 'Nice! We say "went" - irregular verb. What movie did you watch?',
  },
];
