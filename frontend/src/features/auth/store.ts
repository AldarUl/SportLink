// src/features/auth/store.ts
import { create } from "zustand";

type User = { id: string; email: string; displayName?: string };

type Tokens = {
  accessToken: string | null;
  refreshToken?: string | null;
};

type AuthState = Tokens & {
  user: User | null;
  setTokens: (t: Tokens) => void;        // <-- только сигнатуры в типе
  setUser: (u: User | null) => void;     // <-- только сигнатуры в типе
  logout: () => void;                    // <-- только сигнатуры в типе
};

const LS_KEY = "sportlink_tokens";

function load(): Tokens {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { accessToken: null };
    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed?.accessToken ?? null,
      refreshToken: parsed?.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  // стартовые токены: берём из LS если есть
  ...(() => {
    const t = load();
    return {
      accessToken: t.accessToken ?? null,
      refreshToken: t.refreshToken ?? null,
    };
  })(),

  user: null,

  setTokens: (t) => {
    const next = {
      accessToken: t.accessToken ?? null,
      refreshToken: t.refreshToken ?? null,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    set(next);
  },

  setUser: (u) => set({ user: u }),

  logout: () => {
    localStorage.removeItem(LS_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
