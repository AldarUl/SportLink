import { create } from "zustand";
import type { Event, Bbox as ApiBbox } from "./types";
import { fetchEventsByBbox, deleteEvent as apiDeleteEvent } from "./api";

type ViewportBbox = { minLat: number; minLon: number; maxLat: number; maxLon: number };

type EventState = {
  events: Event[];
  fetching: boolean;

  // загрузка по текущему вьюпорту
  fetchViewport: (b: ViewportBbox) => Promise<void>;

  // мутации
  setEvents: (arr: Event[]) => void;
  upsert: (e: Event) => void;
  add: (e: Event) => void;
  updateStatus: (id: string, status: Event["status"]) => void;
  remove: (id: string) => void;
  deleteById: (id: string) => Promise<void>; // удаление на бэке + оптимистично в сторе

  // сервисное
  seed: () => void;
  clear: () => void;
};

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  fetching: false,

  setEvents: (arr) => set({ events: arr, fetching: false }),

  upsert: (e) => {
    const curr = get().events;
    const idx = curr.findIndex((x) => x.id === e.id);
    if (idx === -1) {
      set({ events: [e, ...curr] });
    } else {
      const copy = curr.slice();
      copy[idx] = { ...copy[idx], ...e }; // merge, чтобы не потерять локальные поля
      set({ events: copy });
    }
  },

  add: (e) => get().upsert(e),

  updateStatus: (id, status) => {
    set((s) => ({
      events: s.events.map((ev) => (ev.id === id ? { ...ev, status } : ev)),
    }));
  },

  remove: (id) => set((s) => ({ events: s.events.filter((x) => x.id !== id) })),

  deleteById: async (id) => {
    const prev = get().events;
    // оптимистично убираем
    set({ events: prev.filter((x) => x.id !== id) });
    try {
      await apiDeleteEvent(id); // 200/204 — ок
    } catch (e) {
      // откат при ошибке
      set({ events: prev });
      throw e;
    }
  },

  clear: () => set({ events: [] }),

  seed: () => set({ events: DEMO }),

  fetchViewport: async (b) => {
    set({ fetching: true });
    try {
      const bbox: ApiBbox = { swLat: b.minLat, swLon: b.minLon, neLat: b.maxLat, neLon: b.maxLon };
      const data = await fetchEventsByBbox(bbox);
      set({ events: data, fetching: false });
    } catch (e) {
      console.warn("fetchEventsByBbox failed, fallback to DEMO", e);
      set({ events: DEMO, fetching: false });
    }
  },
}));

const DEMO: Event[] = [];
