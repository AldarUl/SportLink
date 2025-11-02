import { http } from "@/api/http";

export type Sport = { code: string; name: string };
export type UserSkill = { sport: string; level: number; levelLabel?: string };
export type UserSkillUpsertRequest = { level: number };

// baseURL у http уже /api/v1, поэтому пути без префикса
export async function listSports(): Promise<Sport[]> {
  const { data } = await http.get("/sport");
  return data ?? [];
}

export async function listMySkills(): Promise<UserSkill[]> {
  const { data } = await http.get("/user/me/skills");
  return data ?? [];
}

export async function upsertSkill(sport: string, body: UserSkillUpsertRequest): Promise<UserSkill> {
  const { data } = await http.put(`/user/me/skills/${encodeURIComponent(sport)}`, body);
  return data;
}

export async function deleteSkill(sport: string): Promise<void> {
  await http.delete(`/user/me/skills/${encodeURIComponent(sport)}`);
}
