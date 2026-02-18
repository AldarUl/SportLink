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
import { useApplicationStore } from "@/entities/application/store";

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

function humanizeStart(startIso?: string | Date) {
  if (!startIso) return null;
  const d = new Date(startIso);
  const now = new Date();
  const isToday  = d.toDateString() === now.toDateString();
  const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tmr.toDateString();

  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dayMonth = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }); // «02 ноя»
  if (isToday) return `Сегодня в ${time}`;
  if (isTomorrow) return `Завтра в ${time}`;
  return `${dayMonth} в ${time}`;
}

function downloadIcsForEvent(e: any) {
  try {
    const dtStart = new Date(e.startsAt);
    const dtEnd = new Date(+dtStart + (e.durationMin || 60) * 60000);

    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); // 20250102T183000Z

    const esc = (s: string) => String(s ?? "").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SportLink//ru",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${e.id}@sportlink`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(dtStart)}`,
      `DTEND:${fmt(dtEnd)}`,
      `SUMMARY:${esc(e.title || "Тренировка")}`,
      `DESCRIPTION:${esc(e.description || "")}`,
      e.locationLat && e.locationLon ? `GEO:${e.locationLat};${e.locationLon}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(e.title || "training").replace(/\s+/g, "_")}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch { /* no-op */ }
}

function isEventPast(e: any): boolean {
  if (!e?.startsAt) return false;
  const start = new Date(e.startsAt).getTime();
  const durMs = (e.durationMin ?? 60) * 60000;
  const end = start + durMs;
  return Date.now() > end;
}

function StatusBadge({ s }: { s: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | string }) {
  const map: Record<string, string> = {
    PENDING:    "bg-amber-50 text-amber-800",
    CONFIRMED:  "bg-emerald-50 text-emerald-700",
    DECLINED:   "bg-red-50 text-red-600",
    WAITLISTED: "bg-blue-50 text-blue-700",
  };
  const cls = map[s] ?? "bg-gray-100 text-gray-600";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium uppercase ${cls}`}>{s}</span>;
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
function MyTrainingsPanel({
  mine,
  myPos,
  onWithdraw,
}: {
  mine: { id: string; status: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED"; event: AppEvent }[];
  myPos: LngLat | null;
  onWithdraw: (eventId: string) => void | Promise<void>;
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
  const past     = withEvent.filter((a) =>  isEventPast(a.event));

  // сортировки
  const sortByStartAsc  = (a: any, b: any) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime();
  const sortByStartDesc = (a: any, b: any) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime();

  const visible =
    tab === "ALL" ? [...upcoming].sort(sortByStartAsc).concat([...past].sort(sortByStartDesc))
    : tab === "UPCOMING" ? [...upcoming].sort(sortByStartAsc)
    : [...past].sort(sortByStartDesc);

  const Tab = ({ id, label, count }: { id: "UPCOMING" | "PAST" | "ALL"; label: string; count: number }) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-md px-2 py-1 text-xs ${tab === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
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
      // оптимистично уберём из «моих заявок» (на случай задержки сети)
      useApplicationStore.getState().purgeByEvent(eventId);
      // серверный DELETE; твой axios-интерсептор сам удалит событие из стора карт
      await http.delete(`/event/${eventId}`);
      // если по политике бэка организатор автоматически записывается участником —
      // «мои заявки» уже очищены выше. Дополнительно можно подтянуть loadMine(), если хочешь.
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
      <div className="border-b px-4 py-3 text-sm font-semibold shrink-0">
        Мои ближайшие тренировки
      </div>

      {/* табы */}
      <div className="px-3 pt-2">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <Tab id="UPCOMING" label="Активные" count={upcoming.length} />
          <Tab id="PAST"     label="Прошедшие" count={past.length} />
          <Tab id="ALL"      label="Все" count={withEvent.length} />
        </div>
      </div>

      <div className="overflow-y-auto px-3 pb-4">
        {!withEvent.length && (
          <div className="m-3 rounded-lg border px-3 py-2 text-sm text-gray-600">
            Пока нет записей.
          </div>
        )}

        {visible.map((a) => {
          const e: any = a.event;
          const when = e.startsAt;
          const human = humanizeStart(when);
          const timeLeft = when ? formatTimeLeft(when) : null;
          const orgId = e.organizerId || e.organizer?.id;
          const pastEv = isEventPast(e);

          const isOrganizer = meId && orgId && String(orgId).toLowerCase() === String(meId).toLowerCase();
          const canWithdraw = !isOrganizer && (a.status === "PENDING" || a.status === "CONFIRMED" || a.status === "WAITLISTED");

          return (
            <div key={a.id} className="mb-3 rounded-xl border p-3 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-snug">{e.title || "Без названия"}</div>
                  <div className="text-xs text-gray-500">
                    {(e.kind || "TRAINING").toString().toUpperCase() === "EVENT" ? "Событие" : "Тренировка"}
                    {e.sport ? ` · ${e.sport}` : ""}{e.status ? ` · ${e.status}` : ""}{pastEv ? " · завершено" : ""}
                  </div>
                </div>
                <StatusBadge s={a.status} />
              </div>

              <div className="space-y-1 text-xs">
                {orgId && (
                  <div>
                    Организатор:{" "}
                    <Link to={`/profile/${orgId}`} className="text-blue-600 hover:underline">профиль</Link>
                    {" · "}
                    <Link to={`/chat?peerId=${orgId}&eventId=${e.id}`} className="text-gray-700 hover:underline">чат</Link>
                  </div>
                )}
                {human && <div className="text-gray-800">{human}</div>}
                {timeLeft && !pastEv && <div className="text-gray-600">{timeLeft}</div>}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                  onClick={() => openRoute({ lat: e.locationLat, lon: e.locationLon })}
                  disabled={!e.locationLat || !e.locationLon || !myPos}
                >
                  Маршрут
                </button>

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

                {/* 👇 заменили «Отозвать» на «Удалить» для организатора */}
                {isOrganizer ? (
                  <button
                    className="ml-auto rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
                    onClick={() => onDeleteEvent(e.id)}
                    disabled={!!deleting[e.id]}
                    title="Удалить событие"
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


/* ===================== RIGHT: Я организатор ===================== */

// ---- Organizer panel: capacity, waitlist, time rules, tabs, bulk actions ----
type AppRow = {
  id: string;
  userId: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | string;
};

function OrganizerPanel({ myEvents }: { myEvents: AppEvent[] }) {
  const meId = useAuthStore((s) => s.user?.id || null);

  const [appsByEvent, setAppsByEvent] = React.useState<Record<string, AppRow[]>>({});
  const [panelOpen, setPanelOpen] = React.useState<Record<string, boolean>>({});
  const [loadingEvent, setLoadingEvent] = React.useState<Record<string, boolean>>({});
  const [rowPending, setRowPending] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});

  // ✅ счётчик для кнопки "Показать заявки (N)" — только PENDING+WAITLISTED (без организатора)
  const [requestCounts, setRequestCounts] = React.useState<Record<string, number>>({});

  // массовые операции — индикатор
  const [bulkBusy, setBulkBusy] = React.useState<Record<string, boolean>>({});

  const sortApps = (items: AppRow[]) =>
    [...items].sort((a, b) => Number(a.status === "PENDING") * -1 - Number(b.status === "PENDING") * -1);

  const organizerIdOf = (e: any) => String(e?.organizerId ?? e?.organizer?.id ?? "");

  const withoutOrganizer = (rows: AppRow[], organizerId: string) =>
    rows.filter((a) => String(a.userId) !== String(organizerId));

  const computeRequestCount = (rows: AppRow[]) =>
    rows.filter((a) => a.status === "PENDING" || a.status === "WAITLISTED").length;

  const prefetch = React.useCallback(async (e: any) => {
    const evId = String(e.id);
    const organizerId = organizerIdOf(e);

    // уже есть данные или уже грузим
    if (appsByEvent[evId] || loadingEvent[evId]) return;

    setLoadingEvent((p) => ({ ...p, [evId]: true }));
    try {
      const page = await applicationsByEvent(evId, 0, 200);
      const rowsRaw = (page.content ?? []) as AppRow[];
      const rows = withoutOrganizer(rowsRaw, organizerId);

      setAppsByEvent((m) => ({ ...m, [evId]: sortApps(rows) }));
      setRequestCounts((m) => ({ ...m, [evId]: computeRequestCount(rows) }));
      setErrors((m) => ({ ...m, [evId]: null }));
    } catch (err: any) {
      setErrors((m) => ({ ...m, [evId]: err?.response?.data?.message || err?.message || "Не удалось загрузить заявки" }));
    } finally {
      setLoadingEvent((p) => ({ ...p, [evId]: false }));
    }
  }, [appsByEvent, loadingEvent]);

  // ✅ подгружаем данные заранее, чтобы подтверждённые участники показывались без нажатия
  React.useEffect(() => {
    (myEvents || []).forEach((e: any) => prefetch(e));
  }, [myEvents, prefetch]);

  const reloadAndOpen = React.useCallback(async (e: any) => {
    const evId = String(e.id);
    const organizerId = organizerIdOf(e);

    setErrors((m) => ({ ...m, [evId]: null }));
    setLoadingEvent((p) => ({ ...p, [evId]: true }));
    try {
      const page = await applicationsByEvent(evId, 0, 200);
      const rowsRaw = (page.content ?? []) as AppRow[];
      const rows = withoutOrganizer(rowsRaw, organizerId);

      setAppsByEvent((m) => ({ ...m, [evId]: sortApps(rows) }));
      setRequestCounts((m) => ({ ...m, [evId]: computeRequestCount(rows) }));
      setPanelOpen((o) => ({ ...o, [evId]: true }));
    } catch (err: any) {
      setErrors((m) => ({ ...m, [evId]: err?.response?.data?.message || err?.message || "Не удалось загрузить заявки" }));
      setPanelOpen((o) => ({ ...o, [evId]: true }));
    } finally {
      setLoadingEvent((p) => ({ ...p, [evId]: false }));
    }
  }, []);

  const act = React.useCallback(async (appId: string, action: "confirm" | "decline", e: any) => {
    const evId = String(e.id);
    const organizerId = organizerIdOf(e);

    setRowPending((rp) => ({ ...rp, [appId]: true }));
    try {
      if (action === "confirm") await apiConfirm(appId);
      else await apiDecline(appId);

      const page = await applicationsByEvent(evId, 0, 200);
      const rowsRaw = (page.content ?? []) as AppRow[];
      const rows = withoutOrganizer(rowsRaw, organizerId);

      setAppsByEvent((m) => ({ ...m, [evId]: sortApps(rows) }));
      setRequestCounts((m) => ({ ...m, [evId]: computeRequestCount(rows) }));
    } catch (err: any) {
      setErrors((m) => ({ ...m, [evId]: err?.response?.data?.message || err?.message || "Операция не удалась" }));
    } finally {
      setRowPending((rp) => ({ ...rp, [appId]: false }));
    }
  }, []);

  const statusRu = (s: string) => {
    switch (s) {
      case "PENDING": return "На рассмотрении";
      case "WAITLISTED": return "В листе ожидания";
      case "CONFIRMED": return "Подтвержден";
      case "DECLINED": return "Отклонен";
      default: return s;
    }
  };

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
          const opened  = !!panelOpen[evId];
          const loading = !!loadingEvent[evId];
          const err     = errors[evId];

          const apps = appsByEvent[evId] || [];

          // capacity/waitlist
          const capacity: number | null =
            typeof e.capacity === "number" && e.capacity > 0 ? e.capacity : null;
          const waitlistEnabled = !!e.waitlistEnabled;

          const confirmed = apps.filter(a => a.status === "CONFIRMED");
          const waiting   = apps.filter(a => a.status === "PENDING" || a.status === "WAITLISTED");
          const declined  = apps.filter(a => a.status === "DECLINED");

          const confirmedCount = confirmed.length;
          const waitingCount   = waiting.length;
          const declinedCount  = declined.length;

          const full      = capacity !== null && confirmedCount >= capacity;
          const available = capacity === null ? Infinity : Math.max(0, capacity - confirmedCount);

          // время/правила
          const now = Date.now();
          const startsAtTs = e.startsAt ? new Date(e.startsAt).getTime() : NaN;
          const started    = Number.isFinite(startsAtTs) && now >= startsAtTs;

          // ✅ вот тут главное: кнопка считает только pending+waitlist (без организатора)
          const teaserCount = requestCounts[evId] ?? waitingCount;

          const busy = !!bulkBusy[evId];

          const doBulkConfirm = async () => {
            setBulkBusy((b) => ({ ...b, [evId]: true }));
            try {
              const toConfirm = waiting.slice(0, available === Infinity ? waiting.length : available);
              await Promise.allSettled(toConfirm.map(a => apiConfirm(a.id)));
              await reloadAndOpen(e);
            } finally {
              setBulkBusy((b) => ({ ...b, [evId]: false }));
            }
          };

          const doBulkDecline = async () => {
            setBulkBusy((b) => ({ ...b, [evId]: true }));
            try {
              await Promise.allSettled(waiting.map(a => apiDecline(a.id)));
              await reloadAndOpen(e);
            } finally {
              setBulkBusy((b) => ({ ...b, [evId]: false }));
            }
          };

          return (
            <div key={evId} className="mb-3 rounded-xl border p-3 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-snug">{e.title || "Без названия"}</div>
                  <div className="text-xs text-gray-500">
                    {(e.kind || "TRAINING").toString().toUpperCase() === "EVENT" ? "Событие" : "Тренировка"}
                    {e.sport ? ` · ${e.sport}` : ""}{e.status ? ` · ${e.status}` : ""}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                    <span>
                      Подтверждено: <b>{confirmedCount}</b>{capacity !== null ? `/${capacity}` : ""}
                    </span>
                    <span className="mx-1">·</span>
                    <span>Лист ожидания: <b>{waitingCount}</b></span>

                    {full && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Мест нет</span>}
                    {started && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">Событие началось</span>}
                    {waitlistEnabled && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">Лист ожидания</span>}
                  </div>
                </div>

                <Link to={`/event/${evId}`} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
                  Подробнее
                </Link>
              </div>

              {/* ✅ Подтвержденные участники ВСЕГДА (вне кнопки) */}
              <div className="mt-2 space-y-2">
                <div className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">
                  Подтвержденные участники {confirmedCount}
                </div>

                {loading && !appsByEvent[evId] ? (
                  <div className="text-xs text-gray-500">Загрузка...</div>
                ) : confirmedCount === 0 ? (
                  <div className="rounded-md border px-2 py-2 text-xs text-gray-600">Список пуст.</div>
                ) : (
                  <div className="space-y-2">
                    {confirmed.map((a) => {
                      const disabledRow = !!rowPending[a.id];
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-2">
                          <div className="leading-tight">
                            <UserInline userId={a.userId} />
                            <div className="text-[11px] text-gray-500">Статус: {statusRu(a.status)}</div>
                          </div>

                          <button
                            disabled={disabledRow || started}
                            className={`w-[140px] rounded-md px-2 py-1 text-xs ${
                              disabledRow || started
                                ? "cursor-not-allowed bg-gray-50 text-gray-500"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                            }`}
                            onClick={() => act(a.id, "decline", e)}
                            title={started ? "Событие уже началось" : "Исключить участника (Отклонить)"}
                          >
                            Исключить
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ✅ Кнопка показывает только ЗАЯВКИ (pending+waitlist) и отклоненные */}
              <button
                className="mt-3 mb-2 rounded-lg bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                onClick={() => (opened ? setPanelOpen({ ...panelOpen, [evId]: false }) : reloadAndOpen(e))}
              >
                {loading ? "Загрузка..." : opened ? "Скрыть заявки" : `Показать заявки (${teaserCount})`}
              </button>

              {opened && (
                <div className="space-y-2">
                  {err && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">{err}</div>
                  )}

                  {!err && (
                    <>
                      {/* массовые действия */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy || started || waitingCount === 0 || available <= 0}
                          className={`rounded-md px-2 py-1 text-xs ${
                            busy || started || waitingCount === 0 || available <= 0
                              ? "cursor-not-allowed bg-emerald-50 text-emerald-700/50"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                          onClick={doBulkConfirm}
                        >
                          Подтвердить всех (в пределах мест)
                        </button>

                        <button
                          disabled={busy || started || waitingCount === 0}
                          className={`rounded-md px-2 py-1 text-xs ${
                            busy || started || waitingCount === 0
                              ? "cursor-not-allowed bg-red-50 text-red-600/50"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                          onClick={doBulkDecline}
                        >
                          Отклонить всех
                        </button>
                      </div>

                      <div className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">
                        Заявки (на рассмотрении + лист ожидания) {waitingCount}
                      </div>

                      {!waiting.length && (
                        <div className="rounded-md border px-2 py-2 text-xs text-gray-600">Список пуст.</div>
                      )}

                      {waiting.map((a) => {
                        const disabledRow = !!rowPending[a.id];
                        const canConfirm =
                          !disabledRow &&
                          !started &&
                          (capacity === null || confirmedCount < capacity);

                        const canDecline = !disabledRow && !started;

                        return (
                          <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-2">
                            <div className="leading-tight">
                              <UserInline userId={a.userId} />
                              <div className="text-[11px] text-gray-500">Статус: {statusRu(a.status)}</div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <button
                                disabled={!canConfirm}
                                className={`w-[140px] rounded-md px-2 py-1 text-xs ${
                                  !canConfirm
                                    ? "cursor-not-allowed bg-emerald-50 text-emerald-700/50"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                                onClick={() => act(a.id, "confirm", e)}
                                title={started ? "Событие уже началось" : full ? "Свободных мест нет" : "Подтвердить участие"}
                              >
                                Подтвердить
                              </button>

                              <button
                                disabled={!canDecline}
                                className={`w-[140px] rounded-md px-2 py-1 text-xs ${
                                  !canDecline
                                    ? "cursor-not-allowed bg-red-50 text-red-600/50"
                                    : "bg-red-50 text-red-600 hover:bg-red-100"
                                }`}
                                onClick={() => act(a.id, "decline", e)}
                                title={started ? "Событие уже началось" : "Отклонить заявку"}
                              >
                                Отклонить
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <div className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">
                        Отклоненные {declinedCount}
                      </div>

                      {!declined.length && (
                        <div className="rounded-md border px-2 py-2 text-xs text-gray-600">Список пуст.</div>
                      )}

                      {declined.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-2">
                          <div className="leading-tight">
                            <UserInline userId={a.userId} />
                            <div className="text-[11px] text-gray-500">Статус: {statusRu(a.status)}</div>
                          </div>
                        </div>
                      ))}
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
  const prevEventIdsRef = useRef<Set<string>>(new Set());
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

// Когда событие пропало из стора — убрать его из "Моих тренировок"
useEffect(() => {
  const current = new Set((events as AppEvent[]).map(e => String(e.id).toLowerCase()));
  const prev = prevEventIdsRef.current;

  const removed: string[] = [];
  prev.forEach((id) => { if (!current.has(id)) removed.push(id); });

  if (removed.length > 0) {
    const purge = useApplicationStore.getState().purgeByEvent;
    removed.forEach((id) => purge(id));
  }

  prevEventIdsRef.current = current;
}, [events]);


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

            // сразу подтянуть "Мои тренировки", если бэкенд делает организатора участником
            loadMine().catch(() => {});

            setCreateState(null);
          }}
        />
      )}
    </div>
  );
}
