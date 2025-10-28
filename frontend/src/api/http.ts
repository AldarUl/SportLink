// src/api/http.ts
import axios from "axios";
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "/api/v1";

// ------- helpers to читать/писать access из Zustand/LS -------
function getAccessToken(): string | null {
  const s = useAuthStore.getState();
  if (s?.accessToken) return s.accessToken;
  try {
    const raw = localStorage.getItem("sportlink_tokens");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accessToken ?? null;
  } catch { return null; }
}
function setAccessToken(token: string | null) {
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: null });
}

// ------- axios instance -------
export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // ОБЯЗАТЕЛЬНО: чтобы refresh-cookie ходила на /auth/refresh
});

// ------- request: подставляем Bearer -------
http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
  }
  return cfg;
});

// ------- response: авто-refresh по 401 с очередью -------
let isRefreshing = false;
let waiters: Array<(t: string | null) => void> = [];

async function callRefresh(): Promise<string> {
  const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
  const newToken: string = data?.accessToken ?? data?.token;
  setAccessToken(newToken);
  return newToken;
}


http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const res = error.response;
    const original: any = error.config as AxiosRequestConfig & { _retry?: boolean };

    // не рефрешим для самих /auth/login|/auth/refresh и если уже пробовали
    const isAuthCall =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/refresh");

    if (res?.status === 401 && !isAuthCall && !original?._retry) {
      // есть параллельный refresh — подписываемся и повторим запрос
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
        });
      }

      try {
        isRefreshing = true;
        const newToken = await callRefresh();
        // будим ждущие
        waiters.forEach((cb) => cb(newToken));
        waiters = [];
        // повторяем исходный запрос
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        original._retry = true;
        return http(original);
      } catch (e) {
        // refresh не удался — логаутим
        waiters.forEach((cb) => cb(null));
        waiters = [];
        useAuthStore.getState().logout(); // очистит LS/Zustand
        // опционально: редирект на логин
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    // прежнее поведение: при обычном 401 без refresh
    if (res?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
