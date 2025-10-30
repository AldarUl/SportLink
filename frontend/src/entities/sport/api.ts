// src/entities/sport/api.ts
import { http } from "@/api/http";

export type Sport = { code: string; name: string };

const SPORTS_FALLBACK: Sport[] = [
  { code: "football", name: "Футбол" },
  { code: "basketball", name: "Баскетбол" },
  { code: "running", name: "Бег" },
  { code: "yoga", name: "Йога" },
  { code: "tennis", name: "Теннис" },
  { code: "swimming", name: "Плавание" },
  { code: "cycling", name: "Велоспорт" },
];

export async function listSports(): Promise<Sport[]> {
  try {
    const { data } = await http.get("/sport");
    if (Array.isArray(data) && data.length) return data;
    return SPORTS_FALLBACK;
  } catch {
    return SPORTS_FALLBACK;
  }
}
