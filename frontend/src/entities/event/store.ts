import { create } from "zustand";
import type { Event, Bbox as ApiBbox } from "./types";
import { fetchEventsByBbox } from "./api"; // ← вместо fetchEventsForViewport

// Внешний BBox, который приходит из MapPage
type ViewportBbox = { minLat: number; minLon: number; maxLat: number; maxLon: number };

type EventState = {
  events: Event[];
  fetching: boolean;
  fetchViewport: (b: ViewportBbox) => Promise<void>;
  seed: () => void;
  clear: () => void;
};

export const useEventStore = create<EventState>((set) => ({
  events: [],
  fetching: false,

  clear: () => set({ events: [] }),

  seed: () => set({ events: DEMO }),

  fetchViewport: async (b) => {
    set({ fetching: true });
    try {
      const bbox: ApiBbox = {
        swLat: b.minLat, swLon: b.minLon,
        neLat: b.maxLat, neLon: b.maxLon,
      };
      const data = await fetchEventsByBbox(bbox);  // ← тут
      set({ events: data, fetching: false });
    } catch (e) {
      console.warn("fetchEventsByBbox failed, fallback to DEMO", e);
      set({ events: DEMO, fetching: false });
    }
  },
}));

// Демо-данные
const DEMO: Event[] = [
  {
    id: "e1",
    kind: "EVENT",
    title: "City Run 5k",
    sport: "running",
    description: "Fun run",
    startsAt: new Date().toISOString(),
    durationMin: 60,
    capacity: 50,
    waitlistEnabled: true,
    access: "PUBLIC",
    admission: "FREE",
    organizerId: "u1",
    status: "PUBLISHED",
    locationLat: 55.761,
    locationLon: 37.620,
  },
  {
    id: "t1",
    kind: "TRAINING",
    title: "Boxing practice",
    sport: "boxing",
    description: "Pads & sparring",
    startsAt: new Date(Date.now() + 864e5).toISOString(),
    durationMin: 90,
    capacity: 10,
    waitlistEnabled: false,
    access: "PUBLIC",
    admission: "PAID",
    organizerId: "u2",
    status: "PUBLISHED",
    locationLat: 55.728,
    locationLon: 37.600,
  },
  {
    id: "t2",
    kind: "TRAINING",
    title: "CrossFit WOD",
    sport: "crossfit",
    description: "",
    startsAt: new Date(Date.now() + 2 * 864e5).toISOString(),
    durationMin: 60,
    capacity: 15,
    waitlistEnabled: true,
    access: "PUBLIC",
    admission: "PAID",
    organizerId: "u3",
    status: "PUBLISHED",
    locationLat: 55.744,
    locationLon: 37.680,
  },
  {
    id: "e2",
    kind: "EVENT",
    title: "Yoga in park",
    sport: "yoga",
    description: "",
    startsAt: new Date(Date.now() + 3 * 864e5).toISOString(),
    durationMin: 60,
    capacity: 30,
    waitlistEnabled: true,
    access: "PUBLIC",
    admission: "FREE",
    organizerId: "u4",
    status: "PUBLISHED",
    locationLat: 55.770,
    locationLon: 37.540,
  },
];
