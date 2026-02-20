import { http } from "@/api/http";

export type Sport = { code: string; name: string };
export type UserSkill = { sport: string; level: number; levelLabel?: string };

// what backend expects for PUT /user/me/skills/{sport}
export type UserSkillUpsertRequest = { level: number };

/**
 * NOTE:
 * Some pages import legacy names (addMySkill, deleteMySkill, etc.).
 * This file exports both the "canonical" API functions and compatibility aliases.
 */

// baseURL in http is already /api/v1, so endpoints here are without that prefix.
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

/* ===================== Compatibility exports ===================== */

// UI code calls addMySkill(sport, level)
export async function addMySkill(sport: string, level: number): Promise<UserSkill> {
  return upsertSkill(sport, { level });
}

// UI code calls updateMySkill(sport, level)
export async function updateMySkill(sport: string, level: number): Promise<UserSkill> {
  return upsertSkill(sport, { level });
}

// Older import name
export async function deleteMySkill(sport: string): Promise<void> {
  return deleteSkill(sport);
}

// Optional aliases (harmless if unused)
export const getMySkills = listMySkills;
export const getSports = listSports;
