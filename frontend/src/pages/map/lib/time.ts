export function formatTimeLeft(startIso: string | Date) {
  const startTs = new Date(startIso).getTime();
  const nowTs = Date.now();
  let diffMs = startTs - nowTs;
  const past = diffMs < 0;
  if (past) diffMs = Math.abs(diffMs);
  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} д.`);
  if (hours) parts.push(`${hours} ч.`);
  if (mins || (!days && !hours)) parts.push(`${mins} мин.`);
  return `${past ? "Прошло" : "До начала"} ${parts.join(" ")}`;
}

export function humanizeStart(startIso?: string | Date) {
  if (!startIso) return null;
  const d = new Date(startIso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tmr.toDateString();

  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dayMonth = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  if (isToday) return `Сегодня в ${time}`;
  if (isTomorrow) return `Завтра в ${time}`;
  return `${dayMonth} в ${time}`;
}

export function isEventPast(e: any): boolean {
  const status = String(e?.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "FINISHED") return true;

  if (!e?.startsAt) return false;
  const start = new Date(e.startsAt).getTime();
  const durMs = (e.durationMin ?? 60) * 60000;
  const end = start + durMs;
  return Date.now() > end;
}
