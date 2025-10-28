import { http } from "@/api/http";
import type { Event } from "@/entities/event/types";

// если бек отдаёт application с вложенным event – достанем его;
// если сразу Event – просто вернём как есть
function asEvent(x:any): Event {
  const e = x?.event ?? x;
  return {
    id: String(e.id),
    kind: e.kind ?? "TRAINING",
    title: e.title,
    sport: e.sport,
    description: e.description ?? null,
    startsAt: e.startsAt ?? e.startAt,
    durationMin: e.durationMin ?? e.duration ?? 60,
    capacity: e.capacity ?? 0,
    waitlistEnabled: Boolean(e.waitlistEnabled ?? e.waitlist_enabled ?? false),
    access: e.access ?? "PUBLIC",
    admission: e.admission ?? "OPEN",
    recurrenceRule: e.recurrenceRule ?? null,
    registrationDeadline: e.registrationDeadline ?? null,
    organizerId: String(e.organizerId ?? e.organizer_id ?? ""),
    clubId: e.clubId ?? null,
    status: e.status ?? "PUBLISHED",
    locationLat: e.locationLat ?? e.lat ?? e.location?.lat ?? null,
    locationLon: e.locationLon ?? e.lon ?? e.location?.lon ?? null,
    createdAt: e.createdAt ?? null,
    updatedAt: e.updatedAt ?? null,
  };
}

export async function myConfirmedEvents(fromISO = new Date().toISOString(), limit = 50): Promise<Event[]> {
  const { data } = await http.get("/application/my", { params: { status: "CONFIRMED", from: fromISO, limit } });
  const arr = Array.isArray(data) ? data : (data?.content ?? data?.items ?? []);
  return arr.map(asEvent);
}

// подгони URL под свой бек (если у тебя другой путь)
export async function applyToEvent(eventId: string) {
  // вариант А: POST /application {eventId}
  const { data } = await http.post("/application", { eventId });
  return data;
}
