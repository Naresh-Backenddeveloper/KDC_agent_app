/**
 * Local storage keys from the spec (2.2): the session token, a per-install id
 * and the unread notification count. Backed by MMKV; move the token to the
 * Keychain / Keystore before release.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

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
      unread: 3,
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
    { name: 'agent-session', storage: persistStorage },
  ),
);

/** "99+" above 99. */
export const badgeText = (n: number) => (n > 99 ? '99+' : String(n));
