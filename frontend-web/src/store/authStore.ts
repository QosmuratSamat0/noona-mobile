import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuth: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setToken: (accessToken: string, refreshToken?: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuth: false,
      login: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken, isAuth: true }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuth: false }),
      setToken: (accessToken, refreshToken) => set((state) => ({ 
        accessToken, 
        refreshToken: refreshToken || state.refreshToken 
      })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
