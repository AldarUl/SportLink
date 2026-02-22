export const LEVEL_LABEL: Record<number, string> = {
  1: "Новичок",
  2: "Любитель",
  3: "Уверенный",
  4: "Продвинутый",
  5: "Профи",
};

export function levelLabel(v?: number | null) {
  const n = Number(v);
  return Number.isFinite(n) && LEVEL_LABEL[n] ? LEVEL_LABEL[n] : v == null ? "—" : String(v);
}

export function levelRangeText(min?: number | null, max?: number | null) {
  const a = min == null ? 1 : Number(min);
  const b = max == null ? 5 : Number(max);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "1–5";
  return a === b ? String(a) : `${a}–${b}`;
}

// Цвет по минимальному уровню (для ТРЕНИРОВОК): 1 = самый простой, 5 = самый сложный
export function trainingLevelColor(minLevel?: number | null): string {
  const n = Number(minLevel ?? 1);
  switch (n) {
    case 5:
      return "#ef4444"; // red
    case 4:
      return "#f97316"; // orange
    case 3:
      return "#f59e0b"; // amber
    case 2:
      return "#22c55e"; // green
    case 1:
    default:
      return "#3b82f6"; // blue
  }
}
