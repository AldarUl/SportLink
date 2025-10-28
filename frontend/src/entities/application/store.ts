// src/entities/application/store.ts
import { create } from "zustand";
import type { Application, ApplicationStatus, Page } from "./types";
import { apply as apiApply, withdraw as apiWithdraw, myApplications } from "./api";
import { http } from "@/api/http";
import type { Event } from "@/entities/event/types";

// Нормализация Event (минимум полей, которых достаточно для UI)
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
    admission: e.admission ?? "AUTO",
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

// Подтянуть детали события по id
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
};

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  mine: [],
  loading: false,
  error: null,

  // Мои заявки (подтягиваем события для удобства UI)
  loadMine: async (page = 0, size = 50) => {
    set({ loading: true, error: null });
    try {
      const resp: Page<Application> = await myApplications(page, size);
      const apps = resp.content;

      // Загружаем события параллельно (не страшно 10–50 штук)
      const enriched = await Promise.all(
        apps.map(async (a) => {
          const ev = await fetchEventById(a.eventId);
          return { ...a, event: ev } as AppWithEvent;
        })
      );

      set({ mine: enriched, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.message || "Не удалось загрузить заявки" });
    }
  },

  // Подача заявки по объекту события (как в MapPage)
  apply: async (ev: Event) => {
    // не дублируем активные
    const existing = get().mine.find(
      (m) => m.eventId === ev.id && (m.status === "PENDING" || m.status === "CONFIRMED")
    );
    if (existing) return;

    const a = await apiApply(ev.id);
    set({ mine: [{ ...a, event: ev }, ...get().mine] });
  },

  // Отозвать по eventId (находим заявку, шлём withdraw по её id)
  withdrawByEvent: async (eventId: string) => {
    const app = get().mine.find((m) => m.eventId === eventId);
    if (!app) return;

    await apiWithdraw(app.id);
    // Можно просто удалить заявку из списка:
    set({ mine: get().mine.filter((m) => m.id !== app.id) });
  },

  findByEventId: (eventId: string) => get().mine.find((m) => m.eventId === eventId),
}));
