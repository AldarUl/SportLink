// src/features/auth/api.ts
import axios from "axios";
import { http } from "@/api/http";
import { useAuthStore } from "./store";

const API_URL = (import.meta.env.VITE_API_URL as string) ?? "/api/v1";

export async function login(email: string, password: string) {
  const { data } = await http.post("/auth/login", { email, password });
  const token = data?.accessToken ?? data?.token;
  if (!token) throw new Error("No access token in response");
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: null });

  // ⬇️ сразу подтягиваем профиль
  try {
    const me = await fetchMe();
    return { ...data, me };
  } catch {
    return data;
  }
}

export async function register(payload: { displayName: string; email: string; password: string }) {
  const { data } = await http.post("/user", payload);
  return data; // { id, email, displayName }
}

export async function fetchMe() {
  const { data } = await http.get("/auth/me");
  const u = {
    id: data.userId,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    blocked: data.blocked,
  };
  useAuthStore.getState().setUser(u);
  return u;
}

export async function logout() {
  try { await http.post("/auth/logout"); } catch {}
  useAuthStore.getState().logout();
}

export async function tryRefresh() {
  // refresh делаем через "чистый" axios, чтобы не отправлять протухший Bearer в заголовке.
  // ВАЖНО: refresh у нас РОТИРУЕМЫЙ. Если прилетят 2 параллельных refresh (React StrictMode в dev,
  // дубли эффектов, два места в коде), один запрос успешно ротирует cookie, а второй уйдёт со СТАРЫМ
  // cookie и получит 401/403. Поэтому делаем single-flight.

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const s: any = useAuthStore.getState();
    const body = s?.refreshToken ? { refreshToken: s.refreshToken } : {};
    const { data } = await axios.post(`${API_URL}/auth/refresh`, body, { withCredentials: true });
    const token = data?.accessToken ?? data?.token;
    if (!token) throw new Error("No access token in refresh");
    useAuthStore.getState().setTokens({ accessToken: token, refreshToken: s?.refreshToken ?? null });
    return data;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

let refreshInFlight: Promise<any> | null = null;
