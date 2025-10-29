import React from "react";
import type { Event as AppEvent } from "@/entities/event/types";
import type { LngLat } from "../lib/geo";
import { formatDateTime, openRouteExternal } from "../lib/fmt";

export function PopupCard({
  e, myPos, coords, hasApp, onApply, onWithdraw, onClose, onMore,
}: {
  e: AppEvent;
  myPos: LngLat | null;
  coords: LngLat;
  hasApp: boolean;
  onApply: (e: AppEvent) => void;
  onWithdraw: (eventId: string) => void;
  onClose: () => void;
  onMore: () => void;
}) {
  return (
    <div className="relative w-72 rounded-xl bg-white p-3 shadow-xl border border-neutral-200/60">
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded px-2 text-sm text-gray-500 hover:bg-gray-100"
        aria-label="Закрыть"
      >
        ×
      </button>

      <div className="font-semibold">{e.title}</div>
      <div className="mt-1 text-[12px] text-gray-500">
        {(e.kind === "TRAINING" ? "Тренировка" : "Событие")} • {e.sport ?? ""} • {formatDateTime(e.startsAt)}
      </div>

      {e.description && <div className="mt-2 text-[13px]">{e.description}</div>}

      <div className="mt-3 flex gap-2">
        <button
          className="sl-btn"
          onClick={() => openRouteExternal(myPos ?? undefined, coords)}
        >
          Маршрут
        </button>

        {!hasApp ? (
          <button className="sl-btn sl-btn--cta" onClick={() => onApply(e)}>Записаться</button>
        ) : (
          <button className="sl-btn sl-btn--danger" onClick={() => onWithdraw(e.id)}>Отозвать</button>
        )}


        <button className="sl-btn" onClick={onMore}>
          Подробнее
        </button>
      </div>
    </div>
  );
}
