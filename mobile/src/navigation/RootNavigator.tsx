import React, { useState } from 'react';
import type { User } from '../entities/auth/model';
import type { AuthTokens } from '../entities/auth/model';
import type { Tab } from '../entities/chat/model';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { BottomTabs } from './BottomTabs';

type Props = {
  tokens: AuthTokens;
  user: User;
  onLogout: () => void;
};

export function RootNavigator({ tokens, user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <>
      {tab === 'home' && <DashboardScreen token={tokens.access_token} user={user} onPractice={() => setTab('chat')} />}
      {tab === 'chat' && <ChatScreen token={tokens.access_token} />}
      {tab === 'stats' && <StatsScreen token={tokens.access_token} />}
      {tab === 'profile' && <ProfileScreen user={user} onLogout={onLogout} />}
      <BottomTabs active={tab} onChange={setTab} />
    </>
  );
}
