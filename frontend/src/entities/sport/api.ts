// src/entities/sport/api.ts
import { http } from "@/api/http";
import { SPORTS_FALLBACK, normalizeSportCode } from "@/shared/lib/sport";

export type Sport = { code: string; name: string };

export async function listSports(): Promise<Sport[]> {
  try {
    const { data } = await http.get("/sport");
    if (!Array.isArray(data) || data.length === 0) return SPORTS_FALLBACK;

    // Normalize to {code,name} + uppercase codes
    return (data as any[])
      .map((s) => ({
        code: normalizeSportCode(s?.code ?? s?.id ?? s?.value ?? ""),
        name: String(s?.name ?? s?.label ?? s?.title ?? ""),
      }))
      .filter((s) => s.code && s.name);
  } catch {
    return SPORTS_FALLBACK;
  }
}
