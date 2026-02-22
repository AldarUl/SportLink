import { create } from "zustand";

export type ToastType = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

type ToastState = {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id" | "createdAt"> & { ttlMs?: number }) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item: ToastItem = { id, type: t.type, message: t.message, createdAt: Date.now() };
    set((s) => ({ items: [item, ...s.items].slice(0, 6) }));

    const ttl = typeof t.ttlMs === "number" ? t.ttlMs : 3500;
    window.setTimeout(() => {
      // удаляем только если ещё существует
      const exists = get().items.some((x) => x.id === id);
      if (exists) get().remove(id);
    }, ttl);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  clear: () => set({ items: [] }),
}));

export const toast = {
  info: (message: string, ttlMs?: number) => useToastStore.getState().push({ type: "info", message, ttlMs }),
  success: (message: string, ttlMs?: number) => useToastStore.getState().push({ type: "success", message, ttlMs }),
  error: (message: string, ttlMs?: number) => useToastStore.getState().push({ type: "error", message, ttlMs }),
};
