// src/features/auth/api.ts
import { http } from "@/api/http";
import { useAuthStore } from "./store";

export async function login(email: string, password: string) {
  const { data } = await http.post("/auth/login", { email, password });
  // Поддерживаем { token } ИЛИ { accessToken } (на всякий случай)
  const token: string | undefined = (data as any)?.token ?? (data as any)?.accessToken;
  if (!token) throw new Error("Auth token not returned by /auth/login");
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: (data as any)?.refreshToken ?? null });
  return data;
}

export async function register(payload: { displayName: string; email: string; password: string; }) {
  const { data } = await http.post("/user", payload);
  return data; // { id, email, displayName }
}

export async function fetchMe() {
  const { data } = await http.get("/auth/me");
  // Нормализуем имя под наше хранилище (у нас user.name?)
  const user = {
    id: (data as any)?.id,
    email: (data as any)?.email,
    name: (data as any)?.name ?? (data as any)?.displayName ?? null,
  };
  useAuthStore.getState().setUser(user as any);
  return user;
}

export async function logout() {
  try { await http.post("/auth/logout"); } catch {}
  useAuthStore.getState().logout();
}

export async function tryRefresh() {
  const { data } = await http.post("/auth/refresh", {});
  const token: string | undefined = (data as any)?.token ?? (data as any)?.accessToken;
  if (!token) throw new Error("Auth token not returned by /auth/refresh");
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: (data as any)?.refreshToken ?? null });
  return data;
}
