// src/features/user/api.ts
import { http } from "@/api/http";

export type UserDTO = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type UpdateMePayload = {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
};

export type SkillDTO = { sport: string; level: number };

// === helpers ===

/**
 * Базовый origin бэкенда для абсолютных ссылок.
 * В dev можно НЕ задавать и использовать прокси Vite для /avatars.
 * В prod удобно задать, например: VITE_BACKEND_ORIGIN=https://api.mysite.com
 */
const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || "";

/** Делает абсолютный URL, если передали относительный */
function toAbsolute(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  // относительный → приклеиваем origin (если задан)
  return BACKEND_ORIGIN ? `${BACKEND_ORIGIN}${url.startsWith("/") ? url : "/" + url}` : url;
}

/** Нормализуем пользователя из ответа бэкенда */
function toUserDTO(raw: any): UserDTO {
  let avatar: string | null =
    raw?.avatarUrl ?? raw?.avatar_url ?? raw?.avatar ?? null;

  // Если пришло только имя файла — соберём путь вида /avatars/<file>
  if (avatar && !avatar.startsWith("/") && !avatar.startsWith("http")) {
    avatar = `/avatars/${avatar}`;
  }

  // При необходимости сделаем абсолютной
  if (avatar) avatar = toAbsolute(avatar);

  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.displayName ?? null,
    avatarUrl: avatar ?? null,
  };
}

// === API ===

/** Публичный профиль по ID */
export async function getUser(id: string): Promise<UserDTO> {
  const { data } = await http.get(`/user/${id}`);
  return toUserDTO(data);
}

/** Обновить свой профиль (имя/пароль) */
export async function updateMe(payload: UpdateMePayload): Promise<UserDTO> {
  const { data } = await http.patch("/user/me", payload);
  return toUserDTO(data);
}

/** Навыки конкретного пользователя (публично) */
export async function listSkillsByUser(userId: string): Promise<SkillDTO[]> {
  const { data } = await http.get(`/user/${userId}/skills`);
  return data ?? [];
}

/** Загрузить аватар (multipart) */
export async function uploadAvatar(file: File): Promise<UserDTO> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post("/user/me/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return toUserDTO(data);
}

export async function deleteAvatar(): Promise<void> {
  await http.delete("/user/me/avatar");
}
