// src/features/auth/api.ts
import { http } from "@/api/http";
import { useAuthStore } from "./store";

export async function login(email: string, password: string) {
  const { data } = await http.post("/auth/login", { email, password });
  const token = data?.accessToken ?? data?.token;
  if (!token) throw new Error("No access token in response");
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: null });
  return data;
}

export async function register(payload: { displayName: string; email: string; password: string }) {
  const { data } = await http.post("/user", payload);
  return data; // { id, email, displayName }
}

export async function fetchMe() {
  const { data } = await http.get("/auth/me");
  const u = { id: data.userId, email: data.email, displayName: data.displayName };
  useAuthStore.getState().setUser(u);
  return u;
}


export async function logout() {
  try { await http.post("/auth/logout"); } catch {}
  useAuthStore.getState().logout();
}

export async function tryRefresh() {
  const { data } = await http.post("/auth/refresh", {});
  const token = data?.accessToken ?? data?.token;
  if (!token) throw new Error("No access token in refresh");
  useAuthStore.getState().setTokens({ accessToken: token, refreshToken: null });
  return data;
}
