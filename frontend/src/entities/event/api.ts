import { http } from "@/api/http";
import type { Event, Page, EventQuery, Bbox } from "./types";

/** Нормализация Event под контракт Swagger */
function toEvent(e: any): Event {
  return {
    id: String(e.id),
    kind: e.kind,                              // "TRAINING" | "EVENT"
    title: e.title,
    sport: e.sport,
    description: e.description ?? null,
    startsAt: e.startsAt,                      // ISO
    durationMin: e.durationMin,
    capacity: e.capacity ?? undefined,
    waitlistEnabled: e.waitlistEnabled ?? undefined,
    access: e.access,                          // "PUBLIC" | "CLUB_ONLY"
    admission: e.admission,                    // "AUTO" | "MANUAL"
    recurrenceRule: e.recurrenceRule ?? null,
    registrationDeadline: e.registrationDeadline ?? null,
    organizerId: String(e.organizerId),
    clubId: e.clubId ?? null,
    status: e.status,                          // "DRAFT" | "PUBLISHED" | "CANCELLED"
    locationLat: e.locationLat ?? null,
    locationLon: e.locationLon ?? null,
  };
}

/** Нормализация Page<Event> под Swagger EventPage */
function toPage(p: any): Page<Event> {
  const content = (p?.content ?? []).map(toEvent);
  return {
    content,
    page: p?.page ?? 0,
    size: p?.size ?? content.length,
    totalElements: p?.totalElements ?? content.length,
    totalPages: p?.totalPages ?? 1,
    last: p?.last ?? true,
  };
}

/** Поиск событий (пагинация и фильтры) */
export async function searchEvents(params: EventQuery): Promise<Page<Event>> {
  const { data } = await http.get("/event", { params });
  if (Array.isArray(data)) {
    const content = data.map(toEvent);
    return {
      content,
      page: 0,
      size: content.length,
      totalElements: content.length,
      totalPages: 1,
      last: true,
    };
  }
  return toPage(data);
}

/** Детали события */
export async function getEvent(id: string): Promise<Event> {
  const { data } = await http.get(`/event/${id}`);
  return toEvent(data);
}

/** Создать событие (согласно EventCreateRequest) */
export async function createEvent(payload: {
  kind: Event["kind"];
  title: string;
  sport: string;
  startsAt: string;
  access: Event["access"];
  admission: Event["admission"];
  organizerId: string;
  description?: string;
  durationMin?: number;
  capacity?: number;
  waitlistEnabled?: boolean;
  recurrenceRule?: string;
  registrationDeadline?: string;
  clubId?: string;
  locationLat?: number;
  locationLon?: number;
}): Promise<Event> {
  const { data } = await http.post("/event", payload);
  return toEvent(data);
}

/** Частичное обновление события */
export async function updateEvent(id: string, patch: Partial<Event>): Promise<Event> {
  const { data } = await http.patch(`/event/${id}`, patch);
  return toEvent(data);
}

/** Публикация / Отмена события */
export async function publishEvent(id: string): Promise<void> {
  await http.post(`/event/${id}/publish`, {});
}
export async function cancelEvent(id: string): Promise<void> {
  await http.post(`/event/${id}/cancel`, {});
}

/** Клиентская фильтрация по BBOX (fallback) */
export function filterByBbox(events: Event[], bbox: Bbox): Event[] {
  const { swLat, swLon, neLat, neLon } = bbox;
  return events.filter(
    (e) =>
      e.locationLat != null &&
      e.locationLon != null &&
      (e.locationLat as number) >= swLat &&
      (e.locationLat as number) <= neLat &&
      (e.locationLon as number) >= swLon &&
      (e.locationLon as number) <= neLon
  );
}

/** Загрузка под вьюпорт (через обычный /event + client-side bbox) */
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
  });
  return filterByBbox(page.content, bbox);
}

/**
 * Серверная загрузка по BBOX через /event?minLat&minLon&maxLat&maxLon[&centerLat&centerLon].
 * Если сервер не поддерживает bbox, падём в client-side фильтрацию.
 */
export async function fetchEventsByBbox(
  bbox: Bbox,
  time?: { from?: string; to?: string },
  size = 500
): Promise<Event[]> {
  try {
    const params: Record<string, any> = {
      minLat: bbox.swLat,
      minLon: bbox.swLon,
      maxLat: bbox.neLat,
      maxLon: bbox.neLon,
      from: time?.from,
      to: time?.to,
      size,
      page: 0,
    };
    if (bbox.centerLat != null) params.centerLat = bbox.centerLat;
    if (bbox.centerLon != null) params.centerLon = bbox.centerLon;

    const { data } = await http.get("/event", { params });
    const arr = Array.isArray(data) ? data : (data?.content ?? data?.items ?? []);
    return arr.map(toEvent);
  } catch {
    const page = await searchEvents({
      size,
      page: 0,
      from: time?.from,
      to: time?.to,
    });
    return filterByBbox(page.content, bbox);
  }
}
