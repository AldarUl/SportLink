export const NOT_LAUNCHED_GRACE_MINUTES = 15;

export function eventLifecycleBadge(e: any): string | null {
  const status = String(e?.status || "").toUpperCase();

  if (status === "CANCELLED") return "ОТМЕНЕНО";
  if (status === "FINISHED") return "ЗАВЕРШЕНО";
  if (status === "STARTED") return "ИДЁТ";

  // Если запущено вручную — считаем, что идёт/завершено от launchedAt
  if (e?.launchedAt) {
    const launched = new Date(e.launchedAt).getTime();
    const durMs = (e?.durationMin ?? 60) * 60_000;
    if (Date.now() > launched + durMs) return "ЗАВЕРШЕНО";
    return "ИДЁТ";
  }

  // PUBLISHED без launchedAt: если время начала уже наступило — ждём ручного запуска
  if (status === "PUBLISHED" && e?.startsAt) {
    const start = new Date(e.startsAt).getTime();
    if (Date.now() >= start) {
      const cutoff = start + NOT_LAUNCHED_GRACE_MINUTES * 60_000;
      if (Date.now() < cutoff) return "ОЖИДАЕТ ЗАПУСКА";
      // скорее всего планировщик уже переведёт в CANCELLED, но чтобы UI не "висел" — показываем отмену
      return "ОТМЕНЕНО";
    }
  }

  return null;
}

export function isWaitingForLaunch(e: any): boolean {
  return eventLifecycleBadge(e) === "ОЖИДАЕТ ЗАПУСКА";
}
