export function downloadIcsForEvent(e: any) {
  try {
    const dtStart = new Date(e.startsAt);
    const dtEnd = new Date(+dtStart + (e.durationMin || 60) * 60000);

    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

    const esc = (s: string) => String(s ?? "").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SportLink//ru",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${e.id}@sportlink`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dtStart)}`,
      `DTEND:${fmt(dtEnd)}`,
      `SUMMARY:${esc(e.title || "Тренировка")}`,
      `DESCRIPTION:${esc(e.description || "")}`,
      e.locationLat && e.locationLon ? `GEO:${e.locationLat};${e.locationLon}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(e.title || "training").replace(/\s+/g, "_")}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    /* no-op */
  }
}
