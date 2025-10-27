// src/api/http.ts
import axios from "axios";
import type { AxiosError, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "/api/v1";

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

export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Важно: тип импортирован как `type`, чтобы не было рантайм-экспортов
http.interceptors.request.use((cfg: AxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
  }
  return cfg;
});

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
