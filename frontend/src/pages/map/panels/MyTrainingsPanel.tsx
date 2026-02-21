import React from "react";
import { Link } from "react-router-dom";
import type { Event as AppEvent } from "@/entities/event/types";
import { useAuthStore } from "@/features/auth/store";
import { useApplicationStore } from "@/entities/application/store";
import { http } from "@/api/http";

import type { LngLat } from "../lib/geo";
import { downloadIcsForEvent } from "../lib/ics";
import { formatTimeLeft, humanizeStart, isEventPast } from "../lib/time";
import { sportLabel } from "@/shared/lib/sport";
import { StatusBadge } from "../ui/atoms/StatusBadge";

import { eventLifecycleBadge } from "@/shared/lib/eventLifecycle"; 

/* ===================== LEFT: Мои ближайшие тренировки ===================== */

export function MyTrainingsPanel({
  mine,
  myPos,
  onWithdraw,
  onShowLocation,
}: {
  mine: { id: string; status: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED"; event: AppEvent }[];
  myPos: LngLat | null;
  onWithdraw: (eventId: string) => void | Promise<void>;
  /** Центрировать карту на событии */
  onShowLocation?: (ev: AppEvent) => void;
}) {
  const meId = useAuthStore((s) => s.user?.id || null);
  const [tab, setTab] = React.useState<"UPCOMING" | "PAST" | "ALL">("UPCOMING");
  const [deleting, setDeleting] = React.useState<Record<string, boolean>>({});

  const openRoute = (to: { lat?: number | null; lon?: number | null }) => {
    if (!to.lat || !to.lon || !myPos) return;
    const [lon1, lat1] = myPos;
    const url = `https://yandex.ru/maps/?rtext=${lat1},${lon1}~${to.lat},${to.lon}&rtt=auto`;
    window.open(url, "_blank");
  };

  const copyLink = (id: string) => {
    const href = `${window.location.origin}/event/${id}`;
    navigator.clipboard?.writeText(href).catch(() => {});
  };

  // подготовка списков и счётчиков
  const withEvent = (mine || []).filter((a) => a.event);
  const upcoming = withEvent.filter((a) => !isEventPast(a.event));
  const past = withEvent.filter((a) => isEventPast(a.event));

  // сортировки
  const sortByStartAsc = (a: any, b: any) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime();
  const sortByStartDesc = (a: any, b: any) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime();

  const visible =
    tab === "ALL"
      ? [...upcoming].sort(sortByStartAsc).concat([...past].sort(sortByStartDesc))
      : tab === "UPCOMING"
        ? [...upcoming].sort(sortByStartAsc)
        : [...past].sort(sortByStartDesc);

  const Tab = ({ id, label, count }: { id: "UPCOMING" | "PAST" | "ALL"; label: string; count: number }) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-md px-2 py-1 text-xs ${
        tab === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label} {count}
    </button>
  );

  const onDeleteEvent = async (eventId: string) => {
    if (!eventId) return;
    const yes = window.confirm("Удалить это событие? Действие нельзя отменить.");
    if (!yes) return;

    try {
      setDeleting((m) => ({ ...m, [eventId]: true }));
      await http.delete(`/event/${eventId}`);
      useApplicationStore.getState().purgeByEvent(eventId);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Не удалось удалить событие");
    } finally {
      setDeleting((m) => ({ ...m, [eventId]: false }));
    }
  };

  return (
    <aside
      className="
        absolute left-3 top-3 z-30
        w-[360px] max-w-[40vw]
        inline-flex flex-col
        overflow-hidden rounded-2xl
        bg-white/95 shadow-xl backdrop-blur
        max-h-[calc(100vh-24px)]
      "
    >
      <div className="border-b px-4 py-3 text-sm font-semibold shrink-0">Мои ближайшие тренировки</div>

      {/* табы */}
      <div className="px-3 pt-2">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <Tab id="UPCOMING" label="Активные" count={upcoming.length} />
          <Tab id="PAST" label="Прошедшие" count={past.length} />
          <Tab id="ALL" label="Все" count={withEvent.length} />
        </div>
      </div>

      <div className="overflow-y-auto px-3 pb-4">
        {!withEvent.length && (
          <div className="m-3 rounded-lg border px-3 py-2 text-sm text-gray-600">Пока нет записей.</div>
        )}

        {visible.map((a) => {
          const e: any = a.event;
          const when = e.startsAt;
          const human = humanizeStart(when);
          const timeLeft = when ? formatTimeLeft(when) : null;
          const orgId = e.organizerId || e.organizer?.id;
          const pastEv = isEventPast(e);
          const s = String(e.status || "").toUpperCase();
          const showStatus = s && s !== "PUBLISHED";
          const outcome = pastEv ? (s === "CANCELLED" ? "ОТМЕНЕНО" : (s === "FINISHED" || e.launchedAt ? "ЗАВЕРШЕНО" : "ОТМЕНЕНО")) : null;

          const isOrganizer = meId && orgId && String(orgId).toLowerCase() === String(meId).toLowerCase();
          const canWithdraw =
            !isOrganizer && (a.status === "PENDING" || a.status === "CONFIRMED" || a.status === "WAITLISTED");
          const st = String(e.status || "").toUpperCase();

          // Ручной старт: бэк разрешает удаление, пока событие не запущено (launchedAt=null) и не STARTED/FINISHED
          const canDeleteEvent = isOrganizer && !e.launchedAt && !["STARTED", "FINISHED"].includes(st);
          const canShowLocation = Boolean(onShowLocation && e.locationLat != null && e.locationLon != null);

          return (
            <div key={a.id} className="mb-3 rounded-xl border p-3 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold leading-snug">{e.title || "Без названия"}</div>
                    {outcome && (
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide text-white ${
                          outcome === "ОТМЕНЕНО" ? "bg-red-600" : "bg-gray-900"
                        }`}
                      >
                        {outcome}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(e.kind || "TRAINING").toString().toUpperCase() === "EVENT" ? "Событие" : "Тренировка"}
                    {e.sport ? ` · ${sportLabel(e.sport)}` : ""}
                    {showStatus ? ` · ${s}` : ""}
                  </div>
                </div>
                {a.status !== "CONFIRMED" && <StatusBadge s={a.status} />}
</div>

              <div className="space-y-1 text-xs">
                {orgId && (
                  <div>
                    Организатор:{" "}
                    <Link to={`/profile/${orgId}`} className="text-blue-600 hover:underline">
                      профиль
                    </Link>
                    {" · "}
                    <Link to={`/chat?peerId=${orgId}&eventId=${e.id}`} className="text-gray-700 hover:underline">
                      чат
                    </Link>
                  </div>
                )}
                {human && <div className="text-gray-800">{human}</div>}
                {timeLeft && !pastEv && <div className="text-gray-600">{timeLeft}</div>}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!pastEv && (
                  <>
                    <button
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                      onClick={() => openRoute({ lat: e.locationLat, lon: e.locationLon })}
                      disabled={!e.locationLat || !e.locationLon || !myPos}
                    >
                      Маршрут
                    </button>

                    {canShowLocation && (
                      <button
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => onShowLocation?.(e)}
                        title="Показать место на карте"
                      >
                        Показать
                      </button>
                    )}
                  </>
                )}

                <Link to={`/event/${e.id}`} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
                  Подробнее
                </Link>

                {!pastEv && (
                  <>
                    <button
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                      onClick={() => downloadIcsForEvent(e)}
                    >
                      В календарь
                    </button>
                    <button
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                      onClick={() => copyLink(e.id)}
                      title="Скопировать ссылку"
                    >
                      Ссылка
                    </button>
                  </>
                )}

                {/* организатор: удалить; участник: отозвать */}
                {isOrganizer ? (
                  <button
                    className="ml-auto rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
                    onClick={() => onDeleteEvent(e.id)}
                    disabled={!!deleting[e.id] || !canDeleteEvent}
                    title={canDeleteEvent ? "Удалить событие" : "Нельзя удалить после запуска/завершения"}
                  >
                    {deleting[e.id] ? "Удаление..." : "Удалить"}
                  </button>
                ) : (
                  canWithdraw && !pastEv && (
                    <button
                      className="ml-auto rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                      onClick={() => onWithdraw(e.id)}
                    >
                      Отозвать
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t px-4 py-2 text-[11px] text-gray-500">
        * максимум 3 активные тренировки без пересечений по времени
      </div>
    </aside>
  );
}
