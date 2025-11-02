import { http } from "@/api/http";

export type UserDTO = { id: string; email: string; displayName?: string | null };

export async function getUser(id: string): Promise<UserDTO> {
  const { data } = await http.get(`/user/${id}`);
  return data;
}

export type UpdateMeRequest = {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
};

export async function updateMe(body: UpdateMeRequest): Promise<UserDTO> {
  const { data } = await http.patch("/user/me", body);
  return data;
}

// Публичные навыки (если добавишь эндпоинт /user/{id}/skills)
export async function listSkillsByUser(userId: string): Promise<{ sport: string; level: number }[]> {
  const { data } = await http.get(`/user/${userId}/skills`);
  return data;
}
