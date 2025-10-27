import { create } from "zustand";

type User = { id: string; email: string; name?: string };

type Tokens = { accessToken: string | null; refreshToken: string | null };

type AuthState = Tokens & {
  user: User | null;
  setTokens: (t: Tokens) => void;
  setUser: (u: User | null) => void;
  logout: () => void;
};

const LS_KEY = "sportlink_tokens";

function load(): Tokens {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return { accessToken: null, refreshToken: null }; }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...{ accessToken: null, refreshToken: null }, ...load(),
  user: null,
  setTokens: (t) => {
    localStorage.setItem(LS_KEY, JSON.stringify(t));
    set(t);
  },
  setUser: (u) => set({ user: u }),
  logout: () => {
    localStorage.removeItem(LS_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  }
}));
