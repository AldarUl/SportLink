// src/shared/lib/sport.ts
export type SportItem = { code: string; name: string };

/** Canonical list matching backend /sport */
export const SPORTS_FALLBACK: SportItem[] = [
  { code: "RUNNING", name: "Бег" },
  { code: "FOOTBALL", name: "Футбол" },
  { code: "BASKETBALL", name: "Баскетбол" },
  { code: "VOLLEYBALL", name: "Волейбол" },
  { code: "TENNIS", name: "Теннис" },
  { code: "SWIMMING", name: "Плавание" },
  { code: "CYCLING", name: "Велоспорт" },
  { code: "YOGA", name: "Йога" },
  { code: "BOXING", name: "Бокс" },
  { code: "MMA", name: "MMA" },
];

const map = new Map<string, string>(SPORTS_FALLBACK.map(s => [s.code, s.name]));

/** Normalize any sport code/value to backend-style code (UPPERCASE). */
export function normalizeSportCode(code: string | null | undefined): string {
  const raw = String(code ?? "").trim();
  if (!raw) return "";
  // common cases from old frontend fallback ("running", "football"...)
  const upper = raw.toUpperCase();
  if (map.has(upper)) return upper;

  const lower = raw.toLowerCase();
  const legacy: Record<string, string> = {
    running: "RUNNING",
    football: "FOOTBALL",
    basketball: "BASKETBALL",
    volleyball: "VOLLEYBALL",
    tennis: "TENNIS",
    swimming: "SWIMMING",
    cycling: "CYCLING",
    yoga: "YOGA",
    boxing: "BOXING",
    mma: "MMA",
  };
  return legacy[lower] ?? upper;
}

/** Russian label for sport code. */
export function sportLabel(code: string | null | undefined): string {
  const c = normalizeSportCode(code);
  return map.get(c) ?? (c || "");
}
