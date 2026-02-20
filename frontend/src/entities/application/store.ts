// src/entities/application/store.ts
import { create } from "zustand";
import type { Application, Page } from "./types";
import { apply as apiApply, withdraw as apiWithdraw, myApplications } from "./api";
import { http } from "@/api/http";
import type { Event } from "@/entities/event/types";
import { normalizeSportCode } from "@/shared/lib/sport";
import { useEventStore } from "@/entities/event/store";




// минимальная нормализация Event
function normEvent(e: any): Event {
  return {
    id: String(e.id).toLowerCase(),
    kind: e.kind ?? "TRAINING",
    title: e.title,
    sport: normalizeSportCode(e.sport),
    description: e.description ?? null,
    startsAt: e.startsAt ?? e.startAt,
    durationMin: e.durationMin ?? e.duration ?? 60,
    capacity: e.capacity ?? 0,
    waitlistEnabled: Boolean(e.waitlistEnabled ?? e.waitlist_enabled ?? false),
    access: e.access ?? "PUBLIC",
    admission: e.admission ?? "AUTO",
    recurrenceRule: e.recurrenceRule ?? null,
    registrationDeadline: e.registrationDeadline ?? null,
    organizerId: e.organizerId ? String(e.organizerId).toLowerCase() : "",
    status: e.status ?? "PUBLISHED",
    locationLat: e.locationLat ?? e.lat ?? e.location?.lat ?? null,
    locationLon: e.locationLon ?? e.lon ?? e.location?.lon ?? null,
    createdAt: e.createdAt ?? null,
    updatedAt: e.updatedAt ?? null,
  };
}


async function fetchEventById(id: string): Promise<Event | null> {
  try {
    const { data } = await http.get(`/event/${id}`);
    return normEvent(data);
  } catch {
    return null;
  }
}

type AppWithEvent = Application & { event?: Event | null };

type ApplicationState = {
  mine: AppWithEvent[];
  loading: boolean;
  error: string | null;

  loadMine: (page?: number, size?: number) => Promise<void>;
  apply: (ev: Event) => Promise<void>;
  withdrawByEvent: (eventId: string) => Promise<void>;

  findByEventId: (eventId: string) => AppWithEvent | undefined;
  isJoined: (eventId: string) => boolean; // PENDING/CONFIRMED/WAITLISTED
  purgeByEvent: (eventId: string) => void;
};

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  mine: [],
  loading: false,
  error: null,

loadMine: async (page = 0, size = 50) => {
  set({ loading: true, error: null });
  try {
    const resp: Page<Application> = await myApplications(page, size);
    const apps = resp.content;

    // ВНУТРИ loadMine, блок дедупа замени на:
    const byEvent = new Map<string, Application>();
    const score = (s: string) =>
      s === "CONFIRMED" ? 3 :
      s === "PENDING"   ? 2 :
      s === "WAITLISTED"? 1 : 0;

    for (const a of apps) {
      const prev = byEvent.get(a.eventId);
      if (!prev) { byEvent.set(a.eventId, a); continue; }
      if (score(a.status) > score(prev.status)) byEvent.set(a.eventId, a);
    }
    const deduped = Array.from(byEvent.values());


    // 1) Кэш из предыдущего состояния (чтобы не тащить события повторно)
    const prev = get().mine;
    const prevByEvent = new Map(prev.map((x) => [x.eventId, x.event || null]));

    // 2) Кэш из стора событий (то, что уже есть на карте)
    const evState = useEventStore.getState();
    const evById = new Map<string, Event>();
    (evState.events || []).forEach((e: any) => evById.set(String(e.id), e));

    // 3) Собираем список, помечаем где не хватает event — ИСПОЛЬЗУЕМ deduped
    const enriched: AppWithEvent[] = deduped.map((a) => {
      const cached = prevByEvent.get(a.eventId) || evById.get(a.eventId) || null;
      return { ...a, event: cached };
    });

    set({ mine: enriched, loading: false });

    // 4) Дотягиваем только недостающие события
    const missingIds = Array.from(new Set(enriched.filter((x) => !x.event).map((x) => x.eventId)));
    if (missingIds.length === 0) return;

    const toFetch = missingIds.slice(0, 5);
    const fetched = await Promise.allSettled(
      toFetch.map(async (id) => {
        const { data } = await http.get(`/event/${id}`);
        return { id, ev: normEvent(data) as Event };
      })
    );

    set((s) => {
      const byId = new Map(s.mine.map((m) => [m.id, m]));
      for (const r of fetched) {
        if (r.status === "fulfilled") {
          const { id, ev } = r.value;
          for (const m of byId.values()) {
            if (m.eventId === id) m.event = ev;
          }
        }
      }
      return { mine: Array.from(byId.values()) };
    });
  } catch (e: any) {
    set({ loading: false, error: e?.response?.data?.message || "Не удалось загрузить заявки" });
  }
},


apply: async (ev: Event) => {
  const ACTIVE = new Set(["PENDING","CONFIRMED","WAITLISTED"]);
  const evId = ev.id.toLowerCase();

  const exists = get().mine.find(m => m.eventId.toLowerCase() === evId && ACTIVE.has(m.status));
  if (exists) return;

  const created = await apiApply(evId);

  set(s => {
    const filtered = s.mine.filter(m => m.eventId.toLowerCase() !== evId);
    return { mine: [{ ...created, event: { ...ev, id: evId } }, ...filtered] };
  });
},


withdrawByEvent: async (eventId: string) => {
  const ACTIVE = new Set(["PENDING", "CONFIRMED", "WAITLISTED"]);
  const evId = String(eventId).toLowerCase();

  const app = get().mine.find(m => m.eventId.toLowerCase() === evId && ACTIVE.has(m.status));
  if (!app) return;

  set({ mine: get().mine.filter(m => m.id !== app.id) });
  try { await apiWithdraw(app.id); }
  finally { get().loadMine().catch(() => {}); }
},

findByEventId: (eventId: string) => {
  const key = String(eventId).toLowerCase();
  const list = get().mine.filter(m => m.eventId.toLowerCase() === key);
  if (list.length === 0) return undefined;

  const score = (s: string) =>
    s === "CONFIRMED" ? 3 :
    s === "PENDING"   ? 2 :
    s === "WAITLISTED"? 1 : 0;

  return list.reduce((best, m) => (score(m.status) > score(best.status) ? m : best));
},

  isJoined: (eventId: string) => {
    const key = String(eventId).toLowerCase();
    const a = get().mine.find(m => m.eventId.toLowerCase() === key);
    return Boolean(a && (a.status === "PENDING" || a.status === "CONFIRMED" || a.status === "WAITLISTED"));
  },

  purgeByEvent: (eventId: string) => {
  const key = String(eventId).toLowerCase();
  set(s => ({ mine: s.mine.filter(m => String(m.eventId).toLowerCase() !== key) }));
},

}));
