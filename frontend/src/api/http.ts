import axios from "axios";
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "/api/v1";

/* ------- helpers читать/писать access из Zustand/LS ------- */
function getAccessToken(): string | null {
  const s = useAuthStore.getState();
  if (s?.accessToken) return s.accessToken;
  try {
    const raw = localStorage.getItem("sportlink_tokens");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accessToken ?? null;
  } catch {
    return null;
  }
}
function setAccessToken(token: string | null) {
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: null });
}

/* ------- axios instance ------- */
export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // чтобы refresh-cookie ходила на /auth/refresh
});

/* ------- request: подставляем Bearer ------- */
http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
  }
  return cfg;
});

/* ------- response (SUCCESS): авто-удаление события из стора после DELETE ------- */
http.interceptors.response.use(
  async (response) => {
    try {
      const method = (response.config.method || "").toLowerCase();
      let url = response.config.url || "";

      // нормализуем url (убираем baseURL и query)
      if (url.startsWith(API_URL)) url = url.slice(API_URL.length);
      // матчим .../event/{uuid}[?...]
      const m = url.match(/\/event\/([0-9a-fA-F-]{36})(?:\/)?(?:\?.*)?$/);

      if (method === "delete" && m && (response.status === 200 || response.status === 204)) {
        const id = m[1];
        // ленивый импорт, чтобы не словить циклический импорт
        const mod = await import("@/entities/event/store");
        const st = mod.useEventStore.getState();
        if (st.events.some((x) => x.id === id)) {
          st.remove(id); // синхронно выкинем из стора → карта перерисуется
        }
      }
    } catch {
      /* no-op */
    }
    return response;
  },

  /* ------- response (ERROR): авто-refresh по 401 с очередью ------- */
  async (error: AxiosError) => {
    const res = error.response;
    const original: any = error.config as AxiosRequestConfig & { _retry?: boolean };

    const isAuthCall =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/refresh");

    const shouldRetryWithRefresh =
      (res?.status === 401 || res?.status === 403) && !isAuthCall && !original?._retry;

    // общий флажок/очередь
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let isRefreshing = (globalThis as any).__SL_REFRESHING__ || false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let waiters: Array<(t: string | null) => void> = (globalThis as any).__SL_REFRESH_WAITERS__ || [];

    async function callRefresh(): Promise<string> {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
      const newToken: string = data?.accessToken ?? data?.token;
      setAccessToken(newToken);
      return newToken;
    }

    if (shouldRetryWithRefresh) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          waiters.push((t) => {
            if (t) {
              original.headers = { ...(original.headers || {}), Authorization: `Bearer ${t}` };
              original._retry = true;
              resolve(http(original));
            } else {
              resolve(Promise.reject(error));
            }
          });
          (globalThis as any).__SL_REFRESH_WAITERS__ = waiters;
        });
      }

      try {
        (globalThis as any).__SL_REFRESHING__ = true;
        const newToken = await callRefresh();
        waiters.forEach((cb) => cb(newToken));
        waiters = [];
        (globalThis as any).__SL_REFRESH_WAITERS__ = waiters;

        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        original._retry = true;
        return http(original);
      } catch (e) {
        waiters.forEach((cb) => cb(null));
        waiters = [];
        (globalThis as any).__SL_REFRESH_WAITERS__ = waiters;

        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(e);
      } finally {
        (globalThis as any).__SL_REFRESHING__ = false;
      }
    }

    if (res?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
