import React from "react";
import type { LngLat } from "../../lib/geo";
import { formatDateTime, openRouteExternal } from "../../lib/fmt";

export function MyTrainingsSheet({
  mine, myPos, onWithdraw,
}: {
  mine: any[];
  myPos: LngLat | null;
  onWithdraw: (eventId: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 mx-auto w-[min(960px,95%)]">
      <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-xl">
        <div className="mb-2 text-sm font-semibold text-gray-700">Мои ближайшие тренировки</div>
        <div className="flex flex-wrap gap-3">
          {mine
            .filter(a => a.event && (a.status === "CONFIRMED" || a.status === "PENDING"))
            .sort((a, b) => new Date(a.event!.startsAt).getTime() - new Date(b.event!.startsAt).getTime())
            .slice(0, 3)
            .map((a) => (
              <div key={a.id} className="flex min-w-[260px] flex-1 items-center justify-between rounded-xl border px-3 py-2">
                <div>
                  <div className="font-medium">{a.event?.title ?? "Тренировка"}</div>
                  <div className="text-xs text-gray-500">{a.event ? formatDateTime(a.event.startsAt) : ""}</div>
                  <div className="text-[11px] text-gray-500">Статус: {a.status}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border px-2 py-1 text-xs"
                    onClick={() => {
                      const to: LngLat | null =
                        a.event?.locationLat != null && a.event?.locationLon != null
                          ? [a.event.locationLon!, a.event.locationLat!]
                          : null;
                      if (to) openRouteExternal(myPos ?? undefined, to);
                    }}
                  >
                    Маршрут
                  </button>
                  <button
                    className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
                    onClick={() => a.event && onWithdraw(a.event.id)}
                  >
                    Отозвать
                  </button>
                </div>
              </div>
            ))}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">* максимум 3 активные тренировки без пересечений по времени</div>
      </div>
    </div>
  );
}
