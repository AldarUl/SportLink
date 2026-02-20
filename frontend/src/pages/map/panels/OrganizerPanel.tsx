import React from "react";
import { Link } from "react-router-dom";
import type { Event as AppEvent } from "@/entities/event/types";
import { useAuthStore } from "@/features/auth/store";
import { applicationsByEvent, confirm as apiConfirm, decline as apiDecline } from "@/entities/application/api";
import { sportLabel } from "@/shared/lib/sport";

import { UserInline } from "../ui/atoms/UserInline";

/* ===================== RIGHT: Я организатор ===================== */

type AppRow = {
  id: string;
  userId: string;
  eventId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | string;
};

function endsAtMs(e: any) {
  const base = Date.parse(e?.launchedAt || e?.startsAt || "");
  const dur = Number(e?.durationMin ?? 60);
  if (!Number.isFinite(base)) return NaN;
  return base + dur * 60 * 1000;
}

function isPastEvent(e: any, nowMs: number) {
  const status = String(e?.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "FINISHED") return true;
  const end = endsAtMs(e);
  return Number.isFinite(end) ? nowMs > end : false;
}

export function OrganizerPanel({
  myEvents,
  onShowLocation,
}: {
  myEvents: AppEvent[];
  /** Центрировать карту на событии */
  onShowLocation?: (ev: AppEvent) => void;
}) {
  const meId = useAuthStore((s) => s.user?.id || null);

  const [tab, setTab] = React.useState<"ACTIVE" | "PAST" | "ALL">("ACTIVE");

  const [appsByEvent, setAppsByEvent] = React.useState<Record<string, AppRow[]>>({});
  const [panelOpen, setPanelOpen] = React.useState<Record<string, boolean>>({});
  const [loadingEvent, setLoadingEvent] = React.useState<Record<string, boolean>>({});
  const [rowPending, setRowPending] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});
  const [filters, setFilters] = React.useState<Record<string, "WAITING" | "DECLINED">>({});
  const [bulkBusy, setBulkBusy] = React.useState<Record<string, boolean>>({});

  // ✅ тизер-счётчик: только PENDING/WAITLISTED (без организатора)
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  const sortApps = (items: AppRow[]) => [...items].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"));

  const loadSummary = React.useCallback(
    async (eventId: string) => {
      try {
        // берём чуть больше, чтобы точно посчитать waiting
        const page = await applicationsByEvent(eventId, 0, 200);
        const raw = (page.content as AppRow[]) || [];
        const filtered = meId ? raw.filter((a) => String(a.userId) !== String(meId)) : raw;
        setAppsByEvent((m) => ({ ...m, [eventId]: sortApps(filtered) }));

        const waiting = filtered.filter((a) => a.status === "PENDING" || a.status === "WAITLISTED").length;
        setCounts((m) => ({ ...m, [eventId]: waiting }));
      } catch {
        // no-op
      }
    },
    [meId]
  );

  // подтягиваем «summary» для всех моих событий (нужно, чтобы confirmed показывались всегда)
  React.useEffect(() => {
    const ids = (myEvents || []).map((e: any) => String(e.id)).filter(Boolean);
    ids.forEach((id) => {
      if (appsByEvent[id] === undefined) loadSummary(id);
    });
  }, [myEvents, appsByEvent, loadSummary]);

  const reload = React.useCallback(
    async (eventId: string) => {
      setErrors((m) => ({ ...m, [eventId]: null }));
      setLoadingEvent((p) => ({ ...p, [eventId]: true }));
      try {
        const page = await applicationsByEvent(eventId, 0, 200);
        const raw = (page.content as AppRow[]) || [];
        const filtered = meId ? raw.filter((a) => String(a.userId) !== String(meId)) : raw;

        setAppsByEvent((m) => ({ ...m, [eventId]: sortApps(filtered) }));
        const waiting = filtered.filter((a) => a.status === "PENDING" || a.status === "WAITLISTED").length;
        setCounts((m) => ({ ...m, [eventId]: waiting }));
        setPanelOpen((o) => ({ ...o, [eventId]: true }));
      } catch (e: any) {
        setErrors((m) => ({ ...m, [eventId]: e?.response?.data?.message || e?.message || "Не удалось загрузить заявки" }));
        setPanelOpen((o) => ({ ...o, [eventId]: true }));
      } finally {
        setLoadingEvent((p) => ({ ...p, [eventId]: false }));
      }
    },
    [meId]
  );

  const act = React.useCallback(
    async (appId: string, action: "confirm" | "decline", eventId: string) => {
      setRowPending((rp) => ({ ...rp, [appId]: true }));
      try {
        if (action === "confirm") await apiConfirm(appId);
        else await apiDecline(appId);
        await reload(eventId);
      } catch (e: any) {
        setErrors((m) => ({ ...m, [eventId]: e?.response?.data?.message || e?.message || "Операция не удалась" }));
      } finally {
        setRowPending((rp) => ({ ...rp, [appId]: false }));
      }
    },
    [reload]
  );

  const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs ${active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
    >
      {children}
    </button>
  );

  const statusRu = (s: string) => {
    switch (s) {
      case "PENDING":
        return "На рассмотрении";
      case "WAITLISTED":
        return "В листе ожидания";
      case "CONFIRMED":
        return "Подтвержден";
      case "DECLINED":
        return "Отклонен";
      default:
        return s;
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

      {/* табы */}
      <div className="px-3 pt-2">
        {(() => {
          const nowMs = Date.now();
          const all = (myEvents || []).filter(Boolean);
          const activeCount = all.filter((e: any) => !isPastEvent(e, nowMs)).length;
          const pastCount = all.length - activeCount;
          return (
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <button
                onClick={() => setTab("ACTIVE")}
                className={`rounded-md px-2 py-1 text-xs ${
                  tab === "ACTIVE" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Активные {activeCount}
              </button>
              <button
                onClick={() => setTab("PAST")}
                className={`rounded-md px-2 py-1 text-xs ${
                  tab === "PAST" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Прошедшие {pastCount}
              </button>
              <button
                onClick={() => setTab("ALL")}
                className={`rounded-md px-2 py-1 text-xs ${
                  tab === "ALL" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Все {all.length}
              </button>
            </div>
          );
        })()}
      </div>

      <div className="overflow-y-auto px-3 pb-4">
        {!myEvents?.length && <div className="m-3 rounded-lg border px-3 py-2 text-sm text-gray-600">Пока нет событий, где вы организатор.</div>}

        {(() => {
          const nowMs = Date.now();
          const all = (myEvents || []).filter(Boolean) as any[];

          const active = all.filter((e) => !isPastEvent(e, nowMs));
          const past = all.filter((e) => isPastEvent(e, nowMs));

          const sortActive = (a: any, b: any) => {
            const ta = Date.parse(a?.startsAt || "");
            const tb = Date.parse(b?.startsAt || "");
            return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
          };
          const sortPast = (a: any, b: any) => {
            const ta = endsAtMs(a);
            const tb = endsAtMs(b);
            return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
          };

          const visible =
            tab === "ALL"
              ? [...active].sort(sortActive).concat([...past].sort(sortPast))
              : tab === "ACTIVE"
                ? [...active].sort(sortActive)
                : [...past].sort(sortPast);

          return visible.map((e: any) => {
          const evId = String(e.id);
          const opened = panelOpen[evId];
          const loading = loadingEvent[evId];
          const err = errors[evId];

          const apps = appsByEvent[evId] || [];
          const tab = filters[evId] || "WAITING";

          // время/правила
          const status = String(e.status || "").toUpperCase();
          const now = Date.now();
          const startsAtTs = e.startsAt ? new Date(e.startsAt).getTime() : NaN;
          const regTs = e.registrationDeadline ? new Date(e.registrationDeadline).getTime() : NaN;
          // Важно: старт — только по нажатию организатора (status STARTED / launchedAt), а не по расписанию.
          const started = status === "STARTED" || status === "FINISHED" || Boolean(e.launchedAt);
          const finished = status === "FINISHED";
          const cancelled = status === "CANCELLED";
          const schedulePassed = Number.isFinite(startsAtTs) && now >= startsAtTs && !started && !finished && !cancelled;
          const closed = Number.isFinite(regTs) && now >= regTs && !started;

          // capacity/waitlist
          const capacity: number | null = typeof e.capacity === "number" && e.capacity > 0 ? e.capacity : null;
          const waitlistEnabled = !!e.waitlistEnabled;

          // ✅ confirmed показываем всегда (не зависит от opened)
          const confirmedApps = apps.filter((a) => a.status === "CONFIRMED");

          const confirmedCount = confirmedApps.length;
          const waitingCount = apps.filter((a) => a.status === "PENDING" || a.status === "WAITLISTED").length;
          const declinedCount = apps.filter((a) => a.status === "DECLINED").length;

          const full = capacity !== null && confirmedCount >= capacity;
          const available = capacity === null ? Infinity : Math.max(0, capacity - confirmedCount);

          const visibleApps = apps.filter((a) =>
            tab === "WAITING" ? a.status === "PENDING" || a.status === "WAITLISTED" : a.status === "DECLINED"
          );

          const busy = !!bulkBusy[evId];
          const canBulkConfirm = !started && waitingCount > 0 && available > 0;
          const canBulkDecline = !started && waitingCount > 0;

          const doBulkConfirm = async () => {
            setBulkBusy((b) => ({ ...b, [evId]: true }));
            try {
              const toConfirm = apps
                .filter((a) => a.status === "PENDING" || a.status === "WAITLISTED")
                .slice(0, available === Infinity ? apps.length : available);
              await Promise.allSettled(toConfirm.map((a) => apiConfirm(a.id)));
              await reload(evId);
            } finally {
              setBulkBusy((b) => ({ ...b, [evId]: false }));
            }
          };

          const doBulkDecline = async () => {
            setBulkBusy((b) => ({ ...b, [evId]: true }));
            try {
              const toDecline = apps.filter((a) => a.status === "PENDING" || a.status === "WAITLISTED");
              await Promise.allSettled(toDecline.map((a) => apiDecline(a.id)));
              await reload(evId);
            } finally {
              setBulkBusy((b) => ({ ...b, [evId]: false }));
            }
          };

          const waitingTeaser = counts[evId] ?? waitingCount;
          const showConfirmBulk = waitlistEnabled;

          const canShowLocation = Boolean(onShowLocation && e.locationLat != null && e.locationLon != null);

          const copyLink = () => {
            const href = `${window.location.origin}/event/${evId}`;
            navigator.clipboard?.writeText(href).catch(() => {});
          };

          return (
            <div key={evId} className="mb-3 rounded-xl border p-3 shadow-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold leading-snug">{e.title || "Без названия"}</div>
                  <div className="text-xs text-gray-500">
                    {(e.kind || "TRAINING").toString().toUpperCase() === "EVENT" ? "Событие" : "Тренировка"}
                    {e.sport ? ` · ${sportLabel(e.sport)}` : ""}
                    {String(e.status || "").toUpperCase() === "PUBLISHED" ? "" : (e.status ? ` · ${String(e.status).toUpperCase()}` : "")}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                    <span>
                      Подтверждено: <b>{confirmedCount}</b>
                      {capacity !== null ? `/${capacity}` : ""}
                    </span>
                    <span className="mx-1">·</span>
                    <span>
                      Лист ожидания: <b>{waitingCount}</b>
                    </span>

                    {full && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Мест нет</span>}
                    {closed && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">Набор закрыт</span>}
                    {started && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">Запущено</span>}
                    {schedulePassed && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">Ждёт запуска</span>}
                    {finished && <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-700">Завершено</span>}
                    {cancelled && <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-700">Отменено</span>}
                    {waitlistEnabled && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">Лист ожидания</span>}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {canShowLocation && (
                    <button
                      className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                      onClick={() => onShowLocation?.(e)}
                      title="Показать место на карте"
                    >
                      Показать
                    </button>
                  )}
                  <button
                    className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={copyLink}
                    title="Скопировать ссылку"
                  >
                    Ссылка
                  </button>
                  <Link to={`/event/${evId}`} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
                    Подробнее
                  </Link>
                </div>
              </div>

              {/* ✅ подтверждённые участники — всегда видны */}
              <div className="mt-2 rounded-lg border bg-white px-2 py-2">
                <div className="mb-1 text-xs font-semibold text-gray-700">Подтверждённые участники ({confirmedCount})</div>
                {confirmedApps.length === 0 ? (
                  <div className="text-xs text-gray-500">Список пуст.</div>
                ) : (
                  <div className="space-y-1">
                    {confirmedApps.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 truncate">
                          <UserInline userId={a.userId} />
                        </div>
                        <button
                          disabled={!!rowPending[a.id] || started}
                          className={`rounded-md px-2 py-1 text-[11px] ${
                            !!rowPending[a.id] || started
                              ? "cursor-not-allowed bg-gray-50 text-gray-500"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                          onClick={() => act(a.id, "decline", evId)}
                          title={started ? "Событие уже началось" : "Исключить участника"}
                        >
                          Исключить
                        </button>
                      </div>
                    ))}
                    {confirmedApps.length > 5 && <div className="text-[11px] text-gray-500">и ещё {confirmedApps.length - 5}…</div>}
                  </div>
                )}
              </div>

              {/* Кнопка: показать заявки (только waiting) */}
              <button
                className="mt-2 rounded-lg bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                onClick={() => (opened ? setPanelOpen({ ...panelOpen, [evId]: false }) : reload(evId))}
              >
                {loading ? "Загрузка..." : opened ? "Скрыть заявки" : `Показать заявки (${waitingTeaser})`}
              </button>

              {opened && (
                <div className="mt-2 space-y-2">
                  {err && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">{err}</div>
                  )}

                  {!err && (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        {/* табы */}
                        <div className="flex flex-col gap-1">
                          <TabBtn
                            active={tab === "WAITING"}
                            onClick={() => setFilters((f) => ({ ...f, [evId]: "WAITING" }))}
                          >
                            Лист ожидания {waitingCount}
                          </TabBtn>
                          <TabBtn
                            active={tab === "DECLINED"}
                            onClick={() => setFilters((f) => ({ ...f, [evId]: "DECLINED" }))}
                          >
                            Отклонённые {declinedCount}
                          </TabBtn>
                        </div>

                        {/* массовые действия */}
                        <div className="flex flex-col items-end gap-1">
                          {showConfirmBulk && (
                            <button
                              disabled={!canBulkConfirm || busy}
                              className={`rounded-md px-2 py-1 text-xs ${
                                !canBulkConfirm || busy
                                  ? "cursor-not-allowed bg-emerald-50 text-emerald-700/50"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                              onClick={doBulkConfirm}
                              title={started ? "Событие уже началось" : full ? "Свободных мест нет" : "Подтвердить всех"}
                            >
                              {busy ? "..." : "Подтвердить всех"}
                            </button>
                          )}
                          <button
                            disabled={!canBulkDecline || busy}
                            className={`rounded-md px-2 py-1 text-xs ${
                              !canBulkDecline || busy
                                ? "cursor-not-allowed bg-red-50 text-red-600/50"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                            onClick={doBulkDecline}
                            title={started ? "Событие уже началось" : "Отклонить всех"}
                          >
                            {busy ? "..." : "Отклонить всех"}
                          </button>
                        </div>
                      </div>

                      {!visibleApps.length && (
                        <div className="rounded-md border px-2 py-2 text-xs text-gray-600">Список пуст.</div>
                      )}

                      {visibleApps.map((a) => {
                        const isDeclined = a.status === "DECLINED";
                        const disabledRow = !!rowPending[a.id];
                        const canConfirm = !disabledRow && !started && !isDeclined && (capacity === null || confirmedCount < capacity);
                        const canDecline = !disabledRow && !started && !isDeclined;

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
                                onClick={() => act(a.id, "confirm", evId)}
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
                                onClick={() => act(a.id, "decline", evId)}
                                title={started ? "Событие уже началось" : "Отклонить заявку"}
                              >
                                Отклонить
                              </button>
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
          });
        })()}
      </div>
    </aside>
  );
}
