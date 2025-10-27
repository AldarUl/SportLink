// src/api/http.ts
import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store";

const API_URL = import.meta.env.VITE_API_URL as string; // напр.: http://localhost:8080/api/v1

export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Добавляем Bearer из стора / localStorage
http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken || localStorage.getItem("token");
  if (token) {
    const h = (cfg.headers ?? {}) as unknown as Record<string, string>;
    h.Authorization = `Bearer ${token}`;
    cfg.headers = h as unknown as InternalAxiosRequestConfig["headers"];
  }
  return cfg;
});

// Без авто-рефреша: при 401 — logout
http.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
