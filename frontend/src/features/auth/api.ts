import { http } from "@/api/http";
import { useAuthStore } from "./store";

export async function login(email: string, password: string) {
  const { data } = await http.post("/auth/login", { email, password });
  useAuthStore.getState().setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  });
  return data;
}

export async function register(payload: { name?: string; email: string; password: string }) {
  const { data } = await http.post("/auth/register", payload);
  // если бэкенд сразу выдаёт токены — сохрани их тут
  return data;
}

export async function fetchMe() {
  const { data } = await http.get("/users/me");
  useAuthStore.getState().setUser(data);
  return data;
}
