// src/entities/auth/api.ts
import { http } from "@/api/http";

export async function register(data: {
  email: string; displayName: string; password: string;
}) {
  // ВАЖНО: регистрация — это /user
  const { data: user } = await http.post("/user", data);
  return user as { id: string; email: string; displayName: string };
}

export async function login(data: { email: string; password: string }) {
  // Логин остаётся /auth/login
  const { data: auth } = await http.post("/auth/login", data);
  // auth = { token, userId, email, displayName }
  localStorage.setItem("token", auth.token);
  return auth;
}

export async function me() {
  const { data } = await http.get("/auth/me"); // нужен Bearer-токен
  return data;
}
