import { create } from "zustand";
import type { Application } from "./types";
import type { Event } from "../event/types";
import { myApplications, applyToEvent, withdrawApplication } from "./api";

const MAX_ACTIVE = 3;

function startMs(e: Event) { return new Date(e.startsAt).getTime(); }
function endMs(e: Event) { return startMs(e) + (e.durationMin ?? 60) * 60000; }
function isFuture(e: Event) { return endMs(e) > Date.now(); }
function overlap(a: Event, b: Event) {
  return startMs(a) < endMs(b) && startMs(b) < endMs(a);
}

type AppState = {
  list: Application[];
  loading: boolean;
  loadMine: () => Promise<void>;

  // проверка: можно ли записаться (нужен список моих будущих событий)
  canJoin: (candidate: Event, myFutureEvents: Event[]) => { ok: true } | { ok: false, reason: string };

  apply: (ev: Event, myFutureEvents: Event[]) => Promise<void>;
  withdraw: (applicationId: string) => Promise<void>;
};

export const useApplicationStore = create<AppState>((set, get) => ({
  list: [],
  loading: false,

  loadMine: async () => {
    set({ loading: true });
    try {
      const list = await myApplications();
      set({ list, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  canJoin: (candidate, myFutureEvents) => {
    const mine = myFutureEvents.filter(isFuture);

    if (mine.length >= MAX_ACTIVE) {
      return { ok: false, reason: `Максимум ${MAX_ACTIVE} активных тренировок` };
    }
    if (mine.some((e) => overlap(e, candidate))) {
      return { ok: false, reason: "Пересечение по времени с уже активной тренировкой" };
    }
    return { ok: true };
  },

  apply: async (ev, myFutureEvents) => {
    const check = get().canJoin(ev, myFutureEvents);
    if (!check.ok) throw new Error(check.reason);
    await applyToEvent(ev.id);
    // обновим мои заявки
    await get().loadMine();
  },

  withdraw: async (applicationId) => {
    await withdrawApplication(applicationId);
    await get().loadMine();
  },
}));
