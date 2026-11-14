/**
 * Session state (spec 2.2): the token, a per-install id and the unread count.
 * Live: the access token is kept in memory only and the refresh token is in the
 * Keychain / Keystore (store/secure.ts); MMKV keeps just the install id and the
 * unread count. Demo: the demo token is kept in MMKV as before.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';
import { API_CONFIG } from '../api/config';

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface SessionState {
  token: string | null;
  installId: string | null;
  unread: number;
  setToken: (t: string) => void;
  clearToken: () => void;
  ensureInstallId: () => string;
  bumpUnread: () => void;
  resetUnread: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      installId: null,
      unread: API_CONFIG.useMock ? 3 : 0,
      setToken: (token) => set({ token }),
      clearToken: () => set({ token: null }),
      ensureInstallId: () => {
        const existing = get().installId;
        if (existing) return existing;
        const id = uuid4();
        set({ installId: id });
        return id;
      },
      bumpUnread: () => set((s) => ({ unread: s.unread + 1 })),
      resetUnread: () => set({ unread: 0 }),
    }),
    {
      name: 'agent-session',
      storage: persistStorage,
      // Live: never write the access token to disk.
      partialize: (s) => (API_CONFIG.useMock ? s : { installId: s.installId, unread: s.unread }),
    },
  ),
);

/** "99+" above 99. */
export const badgeText = (n: number) => (n > 99 ? '99+' : String(n));
