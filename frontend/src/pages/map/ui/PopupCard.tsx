import React, { useState } from "react";
import type { Event as AppEvent } from "@/entities/event/types";
import type { LngLat } from "../lib/geo";
import { formatDateTime, openRouteExternal } from "../lib/fmt";
import { sportLabel } from "@/shared/lib/sport";
import ApplyWithdrawButton from "./balloons/ApplyWithdrawButton";
import { useAuthStore } from "@/features/auth/store";
import { launchEvent } from "@/entities/event/api";
import { useEventStore } from "@/entities/event/store";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "@/shared/lib/apiError";

export function PopupCard({
  e,
  myPos,
  coords,
  onClose,
  onMore,
}: {
  e: AppEvent;
  myPos: LngLat | null;
  coords: LngLat;
  onClose: () => void;
  onMore: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  const isOrganizer = !!me && String(e.organizerId || "").toLowerCase() === String(me.id || "").toLowerCase();
  const navigate = useNavigate();
  const upsert = useEventStore((s) => s.upsert);
  const deleteById = useEventStore((s) => s.deleteById);
  const [busy, setBusy] = useState<null | "launch" | "delete">(null);

  const kind = (e.kind || "EVENT").toUpperCase();
  const kindRu = kind === "TRAINING" ? "Тренировка" : "Событие";

  const startsAtMs = Date.parse(e.startsAt);
  const nowMs = Date.now();
  const launchOpenMs = startsAtMs - 5 * 60 * 1000;
  const launchCloseMs = startsAtMs + 15 * 60 * 1000;
  const tooEarly = nowMs < launchOpenMs;
  const tooLate = nowMs > launchCloseMs;

  const canLaunch =
    isOrganizer &&
    String((e as any).status || "") === "PUBLISHED" &&
    !e.launchedAt &&
    !tooEarly &&
    !tooLate;

  // Управление (после запуска) — только для событий. Для тренировок на попапе оставляем удаление.
  const canManage = isOrganizer && kind === "EVENT" && !!e.launchedAt;

  // Удаление (удобно пользователю): пока событие не запущено и время начала ещё не наступило.
  // Бэк дополнительно защитит от неверных состояний.
  const canDelete =
    isOrganizer &&
    !e.launchedAt &&
    ["DRAFT", "PUBLISHED", "CANCELLED"].includes(String((e as any).status || "")) &&
    nowMs < startsAtMs;

  const launchTitle = tooEarly
    ? "Запуск доступен за 5 минут до начала"
    : tooLate
      ? "Окно запуска прошло (15 минут после начала)"
      : "Запуск доступен за 5 минут до начала и 15 минут после";

  const deleteTitle = e.launchedAt
    ? "Нельзя удалить после запуска"
    : nowMs >= startsAtMs
      ? "Нельзя удалить после начала"
      : "Удалить событие (если оно ещё не началось)";

  const deleteLabel = kind === "TRAINING" ? "Удалить тренировку" : "Удалить событие";

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
        {kindRu} • {sportLabel(e.sport) || ""} • {formatDateTime(e.startsAt)}
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

      {/* Вторая строка — большие action-кнопки */}
      <div className="mt-2">
        {isOrganizer ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!canLaunch || busy !== null}
              className="h-10 rounded-xl bg-emerald-600 text-white disabled:opacity-60"
              title={launchTitle}
              onClick={async () => {
                try {
                  setBusy("launch");
                  const updated = await launchEvent(e.id);
                  upsert(updated);
                  navigate(`/event/${e.id}?manage=1#after`);
                } catch (err) {
                  alert(getApiErrorMessage(err, "Не удалось запустить"));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Запустить
            </button>

            {canManage ? (
              <button className="h-10 rounded-xl bg-slate-900 text-white" onClick={() => navigate(`/event/${e.id}?manage=1#after`)}>
                Управление
              </button>
            ) : (
              <button
                disabled={!canDelete || busy !== null}
                className="h-10 rounded-xl bg-red-600 text-white disabled:opacity-60"
                title={deleteTitle}
                onClick={async () => {
                  const ok = confirm(`${deleteLabel}?`);
                  if (!ok) return;
                  try {
                    setBusy("delete");
                    await deleteById(e.id);
                    onClose();
                  } catch (err) {
                    alert(getApiErrorMessage(err, "Не удалось удалить"));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Удалить
              </button>
            )}
          </div>
        ) : (
          <div className="w-full"><ApplyWithdrawButton event={e} /></div>
        )}
      </div>
    </div>
  );
}
