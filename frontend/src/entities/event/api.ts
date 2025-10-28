import { http } from "@/api/http";
import type { Event, Page, EventQuery, Bbox } from "./types";

function normEvent(e: any): Event {
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

export async function searchEvents(params: EventQuery): Promise<Page<Event>> {
  const { data } = await http.get("/event", { params });

  if (Array.isArray(data)) {
    const content = data.map(normEvent);
    return { content, totalElements: content.length, totalPages: 1, size: content.length, number: 0 };
  }

  const content = (data.content ?? data.items ?? []).map(normEvent);
  return {
    content,
    totalElements: data.totalElements ?? data.total ?? content.length,
    totalPages: data.totalPages ?? 1,
    size: data.size ?? content.length,
    number: data.number ?? data.page ?? 0,
  };
}

export function filterByBbox(events: Event[], bbox: Bbox): Event[] {
  const { swLat, swLon, neLat, neLon } = bbox;
  return events.filter(
    (e) =>
      e.locationLat !== null &&
      e.locationLon !== null &&
      e.locationLat >= swLat &&
      e.locationLat <= neLat &&
      e.locationLon >= swLon &&
      e.locationLon <= neLon
  );
}

export async function fetchEventsForViewport(
  bbox: Bbox,
  time?: { from?: string; to?: string },
  size = 500
): Promise<Event[]> {
  const page = await searchEvents({
    size,
    page: 0,
    from: time?.from,
    to: time?.to,
    status: "PUBLISHED",
  });
  return filterByBbox(page.content, bbox);
}
