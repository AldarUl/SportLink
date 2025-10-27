// src/features/auth/api.ts
import { http } from "@/api/http";
import { useAuthStore } from "./store";

export async function login(email: string, password: string) {
  const { data } = await http.post("/auth/login", { email, password });
  // если бек выдаёт access/refresh — сохрани тут
  // src/features/auth/api.ts
  useAuthStore.getState().setTokens({ accessToken: data.token, refreshToken: null });

  return data;
}

export async function register(payload: {
  displayName: string;
  email: string;
  password: string;
}) {
  // регистрация у тебя на /api/v1/user
  const { data } = await http.post("/user", payload);
  return data; // { id, email, displayName }
}

export async function fetchMe() {
  // по свагеру: GET /api/v1/auth/me
  const { data } = await http.get("/auth/me");
  useAuthStore.getState().setUser(data);
  return data;
}
