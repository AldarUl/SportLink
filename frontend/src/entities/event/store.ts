import { create } from "zustand";
import type { Event, Bbox as ApiBbox } from "./types";
import { fetchEventsByBbox } from "./api"; // ← вместо fetchEventsForViewport

// Внешний BBox, который приходит из MapPage
type ViewportBbox = { minLat: number; minLon: number; maxLat: number; maxLon: number };

type EventState = {
  events: Event[];
  fetching: boolean;
  setEvents: (evts: Event[]) => void;          // <-- добавили
  fetchViewport: (b: ViewportBbox) => Promise<void>;
  seed: () => void;
  clear: () => void;
};

export const useEventStore = create<EventState>((set) => ({
  events: [],
  fetching: false,

  setEvents: (evts) => set({ events: evts, fetching: false }),  // <-- добавили

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
