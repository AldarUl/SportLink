import React, { useState } from "react";
import type { Event as AppEvent } from "@/entities/event/types";
import type { LngLat } from "../lib/geo";
import { formatDateTime, openRouteExternal } from "../lib/fmt";
import ApplyWithdrawButton from "./balloons/ApplyWithdrawButton";
import { useAuthStore } from "@/features/auth/store";
import { http } from "@/api/http";

export function PopupCard({
  e, myPos, coords, onClose, onMore,
}: {
  e: AppEvent;
  myPos: LngLat | null;
  coords: LngLat;
  onClose: () => void;
  onMore: () => void;
}) {
  const me = useAuthStore(s => s.user);
  const isOrganizer = !!me && e.organizerId?.toLowerCase?.() === me.id?.toLowerCase?.();
  const [busy, setBusy] = useState(false);

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

      {/* Первая строка — второстепенные кнопки */}
      <div className="mt-3 flex gap-2">
        <button className="sl-btn" onClick={() => openRouteExternal(myPos ?? undefined, coords)}>
          Маршрут
        </button>
        <button className="sl-btn" onClick={onMore}>
          Подробнее
        </button>
      </div>

      {/* Вторая строка — большая action-кнопка на всю ширину */}
      <div className="mt-2">
        {isOrganizer ? (
          <button
            disabled={busy}
            className="w-full h-10 rounded-xl bg-red-600 text-white disabled:opacity-60"
            onClick={async () => {
              try {
                setBusy(true);
                await http.delete(`/event/${e.id}`);
                onClose(); // убрать попап, маркер обновится при следующей подтяжке
              } finally {
                setBusy(false);
              }
            }}
          >
            Удалить событие
          </button>
        ) : (
          <ApplyWithdrawButton event={e} fullWidth />
        )}
      </div>
    </div>
  );
}
