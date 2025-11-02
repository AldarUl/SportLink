import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEventStore } from "@/entities/event/store";
import type { Event as AppEvent } from "@/entities/event/types";

import { useYmaps } from "./hooks/useYmaps";
import { useGeolocation } from "./hooks/useGeolocation";
import { useViewport } from "./hooks/useViewport";
import { useViewportFetch } from "./hooks/useViewportFetch";
import { useApplyWithOverlap } from "./hooks/useApplyWithOverlap";
import { useAuthStore } from "@/features/auth/store";

import type { LngLat } from "./lib/geo";
import { GeoStatusOverlay } from "./ui/overlays/GeoStatusOverlay";
import { EventMarker } from "./ui/markers/EventMarker";
import { TrainingMarker } from "./ui/markers/TrainingMarker";

import "./styles/mapPins.css";
import { CreateEventModal } from "./ui/modals/CreateEventModal";
import { applicationsByEvent, confirm as apiConfirm, decline as apiDecline } from "@/entities/application/api";
import { http } from "@/api/http";

/* ===================== helpers ===================== */

type YBounds = [[number, number], [number, number]];

function normBounds(b: YBounds) {
  const [[lon1, lat1], [lon2, lat2]] = b;
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  return { minLon, maxLon, minLat, maxLat };
}

const lat2merc = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI / 180) / 2));
const merc2lat = (m: number) => (Math.atan(Math.sinh(m)) * 180) / Math.PI;

function screenToLngLatMercator(
  bounds: YBounds,
  containerW: number,
  containerH: number,
  x: number,
  y: number
): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = normBounds(bounds);
  const tX = Math.min(Math.max(x / containerW, 0), 1);
  const tY = Math.min(Math.max(y / containerH, 0), 1);
  const lon = minLon + (maxLon - minLon) * tX;
  const mercMin = lat2merc(minLat);
  const mercMax = lat2merc(maxLat);
  const mercY = mercMax - (mercMax - mercMin) * tY;
  const lat = merc2lat(mercY);
  return [lon, lat];
}

function formatTimeLeft(startIso: string | Date) {
  const startTs = new Date(startIso).getTime();
  const nowTs = Date.now();
  let diffMs = startTs - nowTs;
  const past = diffMs < 0;
  if (past) diffMs = Math.abs(diffMs);
  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} д.`);
  if (hours) parts.push(`${hours} ч.`);
  if (mins || (!days && !hours)) parts.push(`${mins} мин.`);
  return `${past ? "Прошло" : "До начала"} ${parts.join(" ")}`;
}

/* === User name inline (+axios cache) === */
type UserProfile = { id: string; email?: string; displayName?: string };
const userCache = new Map<string, UserProfile>();
async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    if (userCache.has(userId)) return userCache.get(userId)!;
    const { data } = await http.get(`/user/${userId}`);
    userCache.set(userId, data);
    return data;
  } catch (e) {
    console.warn("loadUserProfile failed", e);
    return null;
  }
}
function UserInline({ userId }: { userId: string }) {
  const [p, setP] = React.useState<UserProfile | null>(userCache.get(userId) || null);
  React.useEffect(() => {
    let dead = false;
    if (!userCache.has(userId)) {
      loadUserProfile(userId).then((u) => { if (!dead && u) setP(u); });
    }
    return () => { dead = true; };
  }, [userId]);
  const name = p?.displayName || p?.email || `Пользователь ${userId.slice(0, 8)}`;
  return <Link to={`/profile/${userId}`} className="text-sm font-medium hover:underline">{name}</Link>;
}

/* ===================== small atoms ===================== */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-600">
      {children}
    </span>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b px-4 py-3 text-sm font-semibold">{children}</div>;
}

/* ===================== LEFT: Мои ближайшие тренировки ===================== */

type MyAppItem = { id: string; status: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED"; event: AppEvent };

function MyTrainingsPanel({
  mine,
  myPos,
  onWithdraw,
}: {
  mine: MyAppItem[];
  myPos: LngLat | null;
  onWithdraw: (eventId: string) => void | Promise<void>;
}) {
  const openRoute = (to: { lat?: number | null; lon?: number | null }) => {
    if (!to.lat || !to.lon || !myPos) return;
    const [lon1, lat1] = myPos;
    const url = `https://yandex.ru/maps/?rtext=${lat1},${lon1}~${to.lat},${to.lon}&rtt=auto`;
    window.open(url, "_blank");
  };

  return (
<aside
  className="
    absolute left-3 top-3 z-30
    w-[360px] max-w-[40vw]
    inline-flex flex-col
    overflow-hidden rounded-2xl
    bg-white/95 shadow-xl backdrop-blur
    max-h-[calc(100vh-24px)]   /* не выше экрана, с учётом отступов */
  "
>
  <div className="border-b px-4 py-3 text-sm font-semibold shrink-0">
    Мои ближайшие тренировки
  </div>
  <div className="overflow-y-auto px-3 pb-4 pt-2">  {/* без h-full */}
        {!mine?.length && (
          <div className="m-3 rounded-lg border px-3 py-2 text-sm text-gray-600">Пока нет записей.</div>
        )}

        {mine?.map((a) => {
          const e: any = a.event;
          const when = e.startsAt || e.startDate || e.date;
          const timeLeft = when ? formatTimeLeft(when) : null;
          const orgId = e.organizerId || e.organizer?.id;

          return (
            <div key={a.id} className="mb-3 rounded-xl border p-3 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-snug">{e.title || "Без названия"}</div>
                  <div className="text-xs text-gray-500">
                    {(e.kind || "TRAINING").toString().toUpperCase() === "EVENT" ? "Событие" : "Тренировка"}
                    {e.sport ? ` · ${e.sport}` : ""}
                    {e.status ? ` · ${e.status}` : ""}
                  </div>
                </div>
                <Pill>{a.status}</Pill>
              </div>

              {orgId && (
                <div className="mb-1 text-xs">
                  Организатор:{" "}
                  <Link to={`/profile/${orgId}`} className="text-blue-600 hover:underline">
                    профиль
                  </Link>
                </div>
              )}

              {timeLeft && <div className="mb-2 text-xs text-gray-600">{timeLeft}</div>}

              <div className="mt-2 flex items-center gap-2">
                <button
                  className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                  onClick={() => openRoute({ lat: e.locationLat, lon: e.locationLon })}
                >
                  Маршрут
                </button>
                <Link to={`/event/${e.id}`} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
                  Подробнее
                </Link>
                {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                  <button
                    className="ml-auto rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    onClick={() => onWithdraw(e.id)}
                  >
                    Отозвать
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-2 text-[11px] text-gray-500">* максимум 3 активные тренировки без пересечений по времени</div>
    </aside>
  );
}

/* ===================== RIGHT: Я организатор ===================== */

// ---- Organizer panel: capacity, waitlist, time rules, tabs, bulk actions ----
type AppRow = {
  id: string;
  userId: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | string;
};

function OrganizerPanel({ myEvents }: { myEvents: AppEvent[] }) {
  const [appsByEvent, setAppsByEvent] = React.useState<Record<string, AppRow[]>>({});
  const [panelOpen, setPanelOpen] = React.useState<Record<string, boolean>>({});
  const [loadingEvent, setLoadingEvent] = React.useState<Record<string, boolean>>({});
  const [rowPending, setRowPending] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});

  // уже были: счётчики всех заявок (totalElements) для кнопки-тизера
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  // фильтр (табы) по каждому событию
  const [filters, setFilters] = React.useState<Record<string, "ALL" | "PENDING" | "CONFIRMED">>({});

  // массовые операции — индикатор
  const [bulkBusy, setBulkBusy] = React.useState<Record<string, boolean>>({});

  const sortApps = (items: AppRow[]) =>
    [...items].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

  const loadCount = React.useCallback(async (eventId: string) => {
    try {
      const page = await applicationsByEvent(eventId, 0, 1);
      setCounts((m) => ({ ...m, [eventId]: page.totalElements ?? (page.content?.length ?? 0) }));
    } catch {/* no-op */}
  }, []);

  // подтягиваем счётчики для «моих» событий
  React.useEffect(() => {
    const ids = (myEvents || []).map((e: any) => String(e.id)).filter(Boolean);
    ids.forEach((id) => { if (counts[id] === undefined) loadCount(id); });
  }, [myEvents, counts, loadCount]);

  const reload = React.useCallback(async (eventId: string) => {
    setErrors((m) => ({ ...m, [eventId]: null }));
    setLoadingEvent((p) => ({ ...p, [eventId]: true }));
    try {
      const page = await applicationsByEvent(eventId, 0, 50);
      setAppsByEvent((m) => ({ ...m, [eventId]: sortApps(page.content as AppRow[]) }));
      setCounts((m) => ({ ...m, [eventId]: page.totalElements ?? (page.content?.length ?? 0) }));
      setPanelOpen((o) => ({ ...o, [eventId]: true }));
    } catch (e: any) {
      setErrors((m) => ({ ...m, [eventId]: e?.response?.data?.message || e?.message || "Не удалось загрузить заявки" }));
      setPanelOpen((o) => ({ ...o, [eventId]: true }));
    } finally {
      setLoadingEvent((p) => ({ ...p, [eventId]: false }));
    }
  }, []);

  const act = React.useCallback(async (appId: string, action: "confirm" | "decline", eventId: string) => {
    setRowPending((rp) => ({ ...rp, [appId]: true }));
    try {
      if (action === "confirm") await apiConfirm(appId);
      else await apiDecline(appId);
      const page = await applicationsByEvent(eventId, 0, 50);
      setAppsByEvent((m) => ({ ...m, [eventId]: sortApps(page.content as AppRow[]) }));
      setCounts((m) => ({ ...m, [eventId]: page.totalElements ?? (page.content?.length ?? 0) }));
    } catch (e: any) {
      setErrors((m) => ({ ...m, [eventId]: e?.response?.data?.message || e?.message || "Операция не удалась" }));
    } finally {
      setRowPending((rp) => ({ ...rp, [appId]: false }));
    }
  }, []);

  // ui атом
  const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs ${active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
    >
      {children}
    </button>
  );

  return (
    <aside
      className="
        absolute right-3 top-3 z-30
        w-[380px] max-w-[42vw]
        inline-flex flex-col
        overflow-hidden rounded-2xl
        bg-white/95 shadow-xl backdrop-blur
        max-h-[calc(100vh-24px)]
      "
    >
      <div className="border-b px-4 py-3 text-sm font-semibold shrink-0">Я организатор</div>

      <div className="overflow-y-auto px-3 pb-4 pt-2">
        {!myEvents?.length && (
          <div className="m-3 rounded-lg border px-3 py-2 text-sm text-gray-600">
            Событий, где вы организатор, в зоне карты нет.
          </div>
        )}

        {myEvents?.map((e: any) => {
          const evId = String(e.id);
          const opened  = panelOpen[evId];
          const loading = loadingEvent[evId];
          const err     = errors[evId];
          const apps    = appsByEvent[evId] || [];
          const tab     = filters[evId] || "ALL";

          // время/правила
          const now = Date.now();
          const startsAtTs = e.startsAt ? new Date(e.startsAt).getTime() : NaN;
          const regTs      = e.registrationDeadline ? new Date(e.registrationDeadline).getTime() : NaN;
          const started    = Number.isFinite(startsAtTs) && now >= startsAtTs;
          const closed     = Number.isFinite(regTs) && now >= regTs && !started;

          // capacity/waitlist
          const capacity: number | null =
            typeof e.capacity === "number" && e.capacity > 0 ? e.capacity : null; // null = безлимит
          const waitlistEnabled = !!e.waitlistEnabled;

          const confirmedCount = apps.filter(a => a.status === "CONFIRMED").length;
          const pendingCount   = apps.filter(a => a.status === "PENDING").length;
          const full           = capacity !== null && confirmedCount >= capacity;
          const available      = capacity === null ? Infinity : Math.max(0, capacity - confirmedCount);

          // фильтрация по табам
          const visibleApps = apps.filter(a =>
            tab === "ALL" ? true : (tab === "PENDING" ? a.status === "PENDING" : a.status === "CONFIRMED")
          );

          // массовые действия
          const busy = !!bulkBusy[evId];
          const canBulkConfirm = !started && pendingCount > 0 && available > 0;
          const canBulkDecline = !started && pendingCount > 0;

          const doBulkConfirm = async () => {
            setBulkBusy((b) => ({ ...b, [evId]: true }));
            try {
              const toConfirm = apps.filter(a => a.status === "PENDING").slice(0, available === Infinity ? apps.length : available);
              await Promise.allSettled(toConfirm.map(a => apiConfirm(a.id)));
              await reload(evId);
            } finally {
              setBulkBusy((b) => ({ ...b, [evId]: false }));
            }
          };
          const doBulkDecline = async () => {
            setBulkBusy((b) => ({ ...b, [evId]: true }));
            try {
              const toDecline = apps.filter(a => a.status === "PENDING");
              await Promise.allSettled(toDecline.map(a => apiDecline(a.id)));
              await reload(evId);
            } finally {
              setBulkBusy((b) => ({ ...b, [evId]: false }));
            }
          };

          const countTeaser = counts[evId] ?? (apps?.length ?? 0);

          return (
            <div key={evId} className="mb-3 rounded-xl border p-3 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-snug">{e.title || "Без названия"}</div>
                  <div className="text-xs text-gray-500">
                    {(e.kind || "TRAINING").toString().toUpperCase() === "EVENT" ? "Событие" : "Тренировка"}
                    {e.sport ? ` · ${e.sport}` : ""}{e.status ? ` · ${e.status}` : ""}
                  </div>

                  {/* сводка по набору */}
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                    <span>
                      Подтверждено: <b>{confirmedCount}</b>{capacity !== null ? `/${capacity}` : ""}
                    </span>
                    <span className="mx-1">·</span>
                    <span>В ожидании: <b>{pendingCount}</b></span>
                    {full && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Мест нет</span>}
                    {closed && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">Набор закрыт</span>}
                    {started && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">Событие началось</span>}
                    {waitlistEnabled && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">Лист ожидания</span>}
                  </div>
                </div>

                <Link to={`/event/${evId}`} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
                  Подробнее
                </Link>
              </div>

              {/* раскрыть/скрыть */}
              <button
                className="mb-2 rounded-lg bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                onClick={() => (opened ? setPanelOpen({ ...panelOpen, [evId]: false }) : reload(evId))}
              >
                {loading ? "Загрузка..." : opened ? "Скрыть заявки" : `Показать заявки (${countTeaser})`}
              </button>

              {opened && (
                <div className="space-y-2">
                  {err && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">{err}</div>
                  )}

                  {!err && (
                    <>
                      {/* табы + массовые действия */}
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <TabBtn active={tab === "ALL"} onClick={() => setFilters((f) => ({ ...f, [evId]: "ALL" }))}>
                            Все {apps.length}
                          </TabBtn>
                          <TabBtn active={tab === "PENDING"} onClick={() => setFilters((f) => ({ ...f, [evId]: "PENDING" }))}>
                            В ожидании {pendingCount}
                          </TabBtn>
                          <TabBtn active={tab === "CONFIRMED"} onClick={() => setFilters((f) => ({ ...f, [evId]: "CONFIRMED" }))}>
                            Подтверждённые {confirmedCount}
                          </TabBtn>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            disabled={busy || !canBulkConfirm}
                            title={
                              started ? "Событие уже началось"
                                : available === 0 ? "Свободных мест нет"
                                : pendingCount === 0 ? "Нет ожидающих"
                                : "Подтвердить ожидающих в рамках свободных мест"
                            }
                            onClick={doBulkConfirm}
                            className={`rounded-md px-2 py-1 text-xs ${
                              busy || !canBulkConfirm
                                ? "cursor-not-allowed bg-emerald-50 text-emerald-700/50"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            Подтвердить всех
                          </button>
                          <button
                            disabled={busy || !canBulkDecline}
                            title={started ? "Событие уже началось" : pendingCount === 0 ? "Нет ожидающих" : "Отклонить всех ожидающих"}
                            onClick={doBulkDecline}
                            className={`rounded-md px-2 py-1 text-xs ${
                              busy || !canBulkDecline
                                ? "cursor-not-allowed bg-red-50 text-red-600/50"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                          >
                            Отклонить всех
                          </button>
                        </div>
                      </div>

                      {/* список */}
                      {!visibleApps.length && (
                        <div className="rounded-md border px-2 py-2 text-xs text-gray-600">Список пуст.</div>
                      )}

                      {visibleApps.map((a) => {
                        const isPending   = a.status === "PENDING";
                        const isConfirmed = a.status === "CONFIRMED";
                        const disabledRow = !!rowPending[a.id];

                        // блокируем действия после старта; confirm — ещё и при полном зале
                        const canConfirm = isPending && !disabledRow && !started && (capacity === null || confirmedCount < capacity);
                        const canDecline = (isPending || isConfirmed) && !disabledRow && !started;

                        return (
                          <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-2">
                            <div className="leading-tight">
                              <UserInline userId={a.userId} />
                              <div className="text-[11px] text-gray-500">Статус: {a.status}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Стабильная заглушка чата */}
                              <Link
                                to={`/chat?peerId=${a.userId}&eventId=${evId}`}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                              >
                                Чат
                              </Link>

                              {isPending && (
                                <>
                                  <button
                                    disabled={!canConfirm}
                                    title={
                                      started ? "Событие уже началось"
                                        : full ? "Свободных мест нет"
                                        : "Подтвердить участие"
                                    }
                                    className={`rounded-md px-2 py-1 text-xs ${
                                      !canConfirm
                                        ? "cursor-not-allowed bg-emerald-50 text-emerald-700/50"
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    }`}
                                    onClick={() => act(a.id, "confirm", evId)}
                                  >
                                    Подтвердить
                                  </button>
                                  <button
                                    disabled={!canDecline}
                                    title={started ? "Событие уже началось" : "Отклонить заявку"}
                                    className={`rounded-md px-2 py-1 text-xs ${
                                      !canDecline
                                        ? "cursor-not-allowed bg-red-50 text-red-600/50"
                                        : "bg-red-50 text-red-600 hover:bg-red-100"
                                    }`}
                                    onClick={() => act(a.id, "decline", evId)}
                                  >
                                    Отклонить
                                  </button>
                                </>
                              )}

                              {/* «Исключить» подтверждённого участника */}
                              {isConfirmed && (
                                <button
                                  disabled={!canDecline}
                                  title={started ? "Событие уже началось" : "Исключить участника (DECLINED)"}
                                  className={`rounded-md px-2 py-1 text-xs ${
                                    !canDecline
                                      ? "cursor-not-allowed bg-gray-50 text-gray-500"
                                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                                  }`}
                                  onClick={() => act(a.id, "decline", evId)}
                                >
                                  Исключить
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}


/* ===================== BOTTOM: Dock (круглые drag-кнопки) ===================== */

function DragDock({
  onDragStart,
  onRecenter,
}: {
  onDragStart: (e: React.DragEvent, kind: "EVENT" | "TRAINING") => void;
  onRecenter: () => void;
}) {
  const CircleBtn = ({
    label,
    sub,
    bg,
    onDragStart,
  }: {
    label: string;
    sub: string;
    bg: string;
    onDragStart: any;
  }) => (
    <div className="flex w-[96px] flex-col items-center">
      <button
        draggable
        onDragStart={onDragStart}
        className={`h-14 w-14 rounded-full ${bg} text-white shadow-md transition active:scale-95`}
        title={sub}
      >
        {label}
      </button>
      <div className="mt-1 text-center text-[11px] text-gray-700">{sub}</div>
    </div>
  );

  // Круглая иконка "Моё место"
  const CircleIconBtn = ({
    title,
    onClick,
    children,
  }: {
    title: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <div className="flex w-[96px] flex-col items-center">
      <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="group flex h-14 w-14 items-center justify-center rounded-full border bg-white shadow-md transition hover:bg-gray-50 active:scale-95"
      >
        {/* Нав-стрелка (как в картах), слегка повёрнута на 45° */}
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-blue-600 transition-transform group-hover:rotate-12 group-active:scale-90"
          fill="currentColor"
          aria-hidden="true"
        >
          {/* форма как у Feather `navigation` но с заливкой */}
          <path d="M12 2l7 19-7-4-7 4 7-19z" />
        </svg>
      </button>
      <div className="mt-1 text-center text-[11px] text-gray-700">{title}</div>
    </div>
  );

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-2xl border bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="flex items-end gap-4">
        <CircleBtn
          label="E"
          sub="Создать событие (drag)"
          bg="bg-amber-500"
          onDragStart={(e: any) => onDragStart(e, "EVENT")}
        />
        <CircleBtn
          label="T"
          sub="Создать тренировку (drag)"
          bg="bg-blue-600"
          onDragStart={(e: any) => onDragStart(e, "TRAINING")}
        />

        <div className="ml-2 h-10 w-px bg-gray-200" />

        <CircleIconBtn title="Моё место" onClick={onRecenter}>
          {/* svg внутри CircleIconBtn выше */}
        </CircleIconBtn>
      </div>
    </div>
  );
}

/* ===================== MAIN ===================== */

type ContextMenuState = {
  coords: [number, number];
  screenX: number;
  screenY: number;
} | null;

type DragPreview = { kind: "EVENT" | "TRAINING"; coords: LngLat } | null;

export default function MapPage() {
  const navigate = useNavigate();
  const events = useEventStore((s) => s.events);
  const { Y, apiReady } = useYmaps();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const me = useAuthStore((s) => s.user);

  const { myPos, geoPending, geoError, location, recenterToMe } = useGeolocation(apiReady);
  const { zoom, zoomRef, onMapUpdate } = useViewport();
  const { handleBounds } = useViewportFetch(zoomRef, () => Infinity);

  const { mine, loadMine, handleApply, withdrawByEvent, findByEventId } = useApplyWithOverlap();
  useEffect(() => { if (isAuthed) loadMine(); }, [isAuthed, loadMine]);

  const [selected, setSelected] = useState<{ e: AppEvent; coords: LngLat } | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const lastBoundsRef = useRef<YBounds | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);
  const [createState, setCreateState] = useState<{ kind: "EVENT" | "TRAINING"; coords: LngLat } | null>(null);

  const onApplySafe = async (ev: AppEvent) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    await handleApply(ev);
  };
  const onWithdrawSafe = async (id: string) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    await withdrawByEvent(id);
  };

  // === OS-like закрытие контекстного меню
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    const handleVisibility = () => { if (document.visibilityState === "hidden") setCtxMenu(null); };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true } as any);
      window.removeEventListener("keydown", handleKeyDown, { capture: true } as any);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (selected && !events.some((x) => x.id === selected.e.id)) setSelected(null);
  }, [events, selected]);

  const markers = useMemo(
    () => (events as AppEvent[]).filter((e) => e.locationLat != null && e.locationLon != null),
    [events]
  );

  const myOrganized = useMemo(() => {
    const myId = me?.id;
    if (!myId) return [] as AppEvent[];
    return markers.filter((e: any) => e.organizerId === myId || e.organizer?.id === myId);
  }, [markers, me?.id]);

  const setNiceDragImage = (e: React.DragEvent, label = "•") => {
    const ghost = document.createElement("div");
    ghost.style.cssText = "width:24px;height:24px;border-radius:999px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;font:600 14px sans-serif";
    ghost.innerText = label;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };
  const handleDragStart = (e: React.DragEvent, kind: "EVENT" | "TRAINING") => {
    e.dataTransfer.setData("text/sportlink-kind", kind);
    e.dataTransfer.effectAllowed = "copy";
    setNiceDragImage(e, kind === "EVENT" ? "E" : "T");
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!containerRef.current || !lastBoundsRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = screenToLngLatMercator(lastBoundsRef.current, rect.width, rect.height, x, y);
    const kind = (e.dataTransfer.getData("text/sportlink-kind") as "EVENT" | "TRAINING") || dragPreview?.kind;
    if (!kind) return;
    setDragPreview({ kind, coords });
  }, [dragPreview?.kind]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("text/sportlink-kind") as "EVENT" | "TRAINING";
    if (!kind || !containerRef.current || !lastBoundsRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = screenToLngLatMercator(lastBoundsRef.current, rect.width, rect.height, x, y) as LngLat;
    setDragPreview(null);
    setCtxMenu(null);
    setSelected(null);
    if (!isAuthed) { navigate("/auth/login"); return; }
    setCreateState({ kind, coords });
  }, [isAuthed, navigate]);

  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current || !lastBoundsRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = screenToLngLatMercator(lastBoundsRef.current, rect.width, rect.height, x, y);
    setCtxMenu({ coords, screenX: x, screenY: y });
    setSelected(null);
  };

  if (!apiReady || !Y) return <div className="w-full h-full" />;

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapListener } = Y;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      onContextMenu={handleContainerContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <GeoStatusOverlay pending={geoPending} error={geoError} />

      {/* LEFT: участник */}
      <MyTrainingsPanel mine={mine as any} myPos={myPos} onWithdraw={onWithdrawSafe} />

      {/* RIGHT: организатор */}
      <OrganizerPanel myEvents={myOrganized} />

      {/* BOTTOM: Dock */}
      <DragDock onDragStart={handleDragStart} onRecenter={recenterToMe} />

      {/* Контекстное меню (ПКМ) */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="absolute z-50 bg-white rounded-lg shadow-lg p-2 min-w-[180px]"
          style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setCreateState({ kind: "EVENT", coords: ctxMenu.coords });
                setCtxMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md"
            >
              Создать событие здесь
            </button>
            <button
              onClick={() => {
                setCreateState({ kind: "TRAINING", coords: ctxMenu.coords });
                setCtxMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md"
            >
              Создать тренировку здесь
            </button>
          </div>
        </div>
      )}

      <YMap ref={mapRef} location={location} className="w-full h-full" showScaleInCopyrights>
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />

        <YMapListener
          onUpdate={(e: any) => {
            const loc = e?.location;
            onMapUpdate(loc);
            const b = loc?.bounds as YBounds | undefined;
            if (b) {
              lastBoundsRef.current = b;
              handleBounds(b);
            }
          }}
          onClick={() => { setSelected(null); setCtxMenu(null); }}
        />

        {/* Я */}
        {myPos && (
          <YMapMarker coordinates={myPos} zIndex={1000}>
            <div className="sl-pin sl-pin--user" title="Вы здесь" />
          </YMapMarker>
        )}

        {/* Превью во время перетаскивания */}
        {dragPreview && (
          <YMapMarker coordinates={dragPreview.coords} zIndex={999}>
            <div className={dragPreview.kind === "TRAINING" ? "sl-pin sl-pin--train ghost" : "sl-pin sl-pin--event ghost"} title="Место создания" />
          </YMapMarker>
        )}

        {/* Маркеры из стора */}
        {markers.map((e) => {
          const coords: LngLat = [e.locationLon as number, e.locationLat as number];
          const isTraining = (e.kind || "EVENT").toUpperCase() === "TRAINING";
          const hasApp = isAuthed && Boolean(findByEventId(e.id));
          const active = selected?.e.id === e.id;

          const commonProps = {
            YMapMarker,
            e,
            coords,
            active,
            hasApp,
            pressedId,
            setPressedId: (id: string | null) => setPressedId(id),
            onOpen: (ev: AppEvent, c: LngLat) => setSelected({ e: ev, coords: c }),
            onApply: onApplySafe,
            onWithdraw: onWithdrawSafe,
            onMore: () => navigate(`/event/${e.id}`),
            myPos,
            onClose: () => setSelected(null),
          };

          return isTraining
            ? <TrainingMarker key={e.id} {...(commonProps as any)} />
            : <EventMarker key={e.id} {...(commonProps as any)} />;
        })}
      </YMap>

      {/* Модалка создания */}
      {createState && (
        <CreateEventModal
          open
          kind={createState.kind}
          coords={createState.coords}
          onClose={() => setCreateState(null)}
          onCreated={(created) => {
            try { useEventStore.getState().add?.(created); } catch {}
            if (lastBoundsRef.current) handleBounds(lastBoundsRef.current);
            setCreateState(null);
          }}
        />
      )}
    </div>
  );
}
