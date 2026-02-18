import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getEvent, cancelEvent, launchEvent } from "@/entities/event/api";
import type { Event } from "@/entities/event/types";
import { useEventStore } from "@/entities/event/store";
import { useAuthStore } from "@/features/auth/store";

import { applicationsByEvent } from "@/entities/application/api";
import { getUser } from "@/entities/user/api"; // <-- файл ниже
import { getMyAttendance, setMyAttendance, setAttendanceForUser } from "@/entities/attendance/api";
import type { AttendanceStatus } from "@/entities/attendance/types";
import { createReview } from "@/entities/review/api";

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

const statusRu = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: "Черновик",
    PUBLISHED: "Опубликовано",
    STARTED: "Идёт",
    FINISHED: "Завершено",
    CANCELLED: "Отменено",
  };
  return map[s] ?? s;
};

type UserRow = { userId: string; name: string };

export default function EventDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [ev, setEv] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"cancel" | "delete" | "launch" | null>(null);

  const meId = useAuthStore((s: any) => s.user?.id || null);

  const updateStatus = useEventStore((s) => s.updateStatus);
  const deleteById = useEventStore((s) => s.deleteById);
  const upsert = useEventStore((s) => s.upsert);
  const existsInStore = useEventStore((s) => s.events.some((x) => x.id === id));

  useEffect(() => {
    if (!loading && !existsInStore) navigate("/map", { replace: true });
  }, [existsInStore, loading, navigate]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await getEvent(id);
        if (!ignore) setEv(data);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  const isOrganizer = useMemo(() => {
    if (!ev || !meId) return false;
    return String((ev as any).organizerId) === String(meId);
  }, [ev, meId]);

  if (loading) return <div className="p-6">Загрузка…</div>;
  if (!ev) return <div className="p-6">Событие не найдено.</div>;

  const statusColor =
    ev.status === "CANCELLED"
      ? "bg-red-100 text-red-700"
      : ev.status === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-700"
      : ev.status === "STARTED"
      ? "bg-blue-100 text-blue-700"
      : ev.status === "FINISHED"
      ? "bg-slate-100 text-slate-700"
      : "bg-gray-100 text-gray-700";

  const handleCancel = async () => {
    if (!confirm("Отменить событие?")) return;
    setActing("cancel");
    try {
      await cancelEvent(ev.id);
      const updated: Event = { ...ev, status: "CANCELLED" as any };
      setEv(updated);
      updateStatus(ev.id, "CANCELLED" as any);
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить событие безвозвратно?")) return;
    setActing("delete");
    try {
      await deleteById(ev.id);
      navigate("/map", { replace: true });
    } finally {
      setActing(null);
    }
  };

  const handleLaunch = async () => {
    if (!confirm("Запустить тренировку?")) return;
    setActing("launch");
    try {
      const updated = await launchEvent(ev.id);
      setEv(updated);
      upsert(updated);
    } finally {
      setActing(null);
    }
  };

  return (
    <EventDetailWithAfterFlow
      ev={ev}
      setEv={setEv}
      isOrganizer={isOrganizer}
      meId={meId}
      statusColor={statusColor}
      handleCancel={handleCancel}
      handleDelete={handleDelete}
      handleLaunch={handleLaunch}
      acting={acting}
    />
  );
}

function EventDetailWithAfterFlow(props: any) {
  const { ev, isOrganizer, meId, statusColor, acting } = props;

  // AFTER FLOW states
  const [myAttendance, setMyAttendanceState] = useState<AttendanceStatus | null>(null);
  const [ratingOrg, setRatingOrg] = useState(5);
  const [commentOrg, setCommentOrg] = useState("");
  const [savingOrgReview, setSavingOrgReview] = useState(false);

  const [savingRow, setSavingRow] = useState<Record<string, boolean>>({});

  // organizer applications panel states (до завершения)
  const [appsOpen, setAppsOpen] = useState(false);
  const [appsLoading, setAppsLoading] = useState(false);

  const [requestsCount, setRequestsCount] = useState(0); // ✅ только PENDING + WAITLISTED
  const [confirmedUsers, setConfirmedUsers] = useState<UserRow[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
  const [waitlistedUsers, setWaitlistedUsers] = useState<UserRow[]>([]);
  const [declinedUsers, setDeclinedUsers] = useState<UserRow[]>([]);

  const showAfter = Boolean(meId) && ev.status === "FINISHED" && ev.status !== "CANCELLED";
  const showOrganizerPanel = Boolean(meId) && isOrganizer && !showAfter; // ✅ как на твоём скрине (до FINISHED)

  // загрузка моей посещаемости (после тренировки)
  useEffect(() => {
    if (!showAfter) return;
    (async () => {
      try {
        const a = await getMyAttendance(ev.id);
        setMyAttendanceState(a?.status ?? null);
      } catch {
        setMyAttendanceState(null);
      }
    })();
  }, [showAfter, ev.id]);

  // ✅ загрузка заявок для организатора (до FINISHED)
  useEffect(() => {
    if (!showOrganizerPanel) return;

    let cancelled = false;

    const loadUsers = async (ids: string[]): Promise<UserRow[]> => {
      const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
      const users = await Promise.all(
        uniqueIds.map(async (uid) => {
          try {
            const u = await getUser(uid);
            return { userId: uid, name: u.displayName || u.email || uid };
          } catch {
            return { userId: uid, name: uid };
          }
        })
      );
      return users;
    };

    (async () => {
      setAppsLoading(true);
      try {
        const pg = await applicationsByEvent(ev.id, 0, 200);

        const organizerId = String((ev as any).organizerId);

        // 1) ❗️убираем заявку организатора полностью (если она есть в БД)
        const apps = (pg.content ?? []).filter((a: any) => String(a.userId) !== organizerId);

        // 2) группируем по статусам
        const pending = apps.filter((a: any) => a.status === "PENDING");
        const waitlisted = apps.filter((a: any) => a.status === "WAITLISTED");
        const confirmed = apps.filter((a: any) => a.status === "CONFIRMED");
        const declined = apps.filter((a: any) => a.status === "DECLINED");

        // 3) ✅ счётчик кнопки: только PENDING + WAITLISTED
        const cnt = pending.length + waitlisted.length;

        // 4) получаем юзеров для списков
        const confirmedList = await loadUsers(confirmed.map((a: any) => String(a.userId)));
        const pendingList = await loadUsers(pending.map((a: any) => String(a.userId)));
        const waitlistedList = await loadUsers(waitlisted.map((a: any) => String(a.userId)));
        const declinedList = await loadUsers(declined.map((a: any) => String(a.userId)));

        if (cancelled) return;

        setRequestsCount(cnt);
        setConfirmedUsers(confirmedList);
        setPendingUsers(pendingList);
        setWaitlistedUsers(waitlistedList);
        setDeclinedUsers(declinedList);
      } finally {
        if (!cancelled) setAppsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showOrganizerPanel, ev.id]);

  const setMy = async (status: AttendanceStatus) => {
    const a = await setMyAttendance(ev.id, status);
    setMyAttendanceState(a.status);
  };

  const rateOrganizer = async () => {
    if (!meId) return;
    setSavingOrgReview(true);
    try {
      await createReview({
        eventId: ev.id,
        targetUserId: String((ev as any).organizerId),
        rating: ratingOrg,
        comment: commentOrg || null,
      });
      alert("Оценка отправлена");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Не удалось отправить оценку");
    } finally {
      setSavingOrgReview(false);
    }
  };

  const markAttendanceFor = async (userId: string, status: AttendanceStatus) => {
    setSavingRow((m) => ({ ...m, [userId]: true }));
    try {
      await setAttendanceForUser(ev.id, userId, status);
      alert("Посещаемость сохранена");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Не удалось сохранить посещаемость");
    } finally {
      setSavingRow((m) => ({ ...m, [userId]: false }));
    }
  };

  const rateParticipant = async (userId: string, rating: number) => {
    setSavingRow((m) => ({ ...m, [userId]: true }));
    try {
      await createReview({
        eventId: ev.id,
        targetUserId: userId,
        rating,
        comment: null,
      });
      alert("Оценка участнику отправлена");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Не удалось отправить оценку");
    } finally {
      setSavingRow((m) => ({ ...m, [userId]: false }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{ev.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={statusColor}>{statusRu(ev.status)}</Badge>
            <Badge className="bg-blue-100 text-blue-700">{ev.kind}</Badge>
            <Badge className="bg-slate-100 text-slate-700">{ev.sport}</Badge>
            <Badge className="bg-violet-100 text-violet-700">{ev.admission}</Badge>
            <Badge className="bg-amber-100 text-amber-700">{ev.access}</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isOrganizer && (
            <>
              <Link to={`/event/${ev.id}/edit`} className="rounded-md px-3 py-1.5 bg-black text-white text-sm">
                Редактировать
              </Link>

              {ev.status === "PUBLISHED" && (
                <button
                  disabled={acting === "cancel"}
                  onClick={props.handleCancel}
                  className="rounded-md px-3 py-1.5 bg-orange-600 text-white text-sm disabled:opacity-50"
                >
                  {acting === "cancel" ? "Отмена…" : "Отменить"}
                </button>
              )}

              {ev.status === "STARTED" && !(ev as any).launchedAt && (
                <button
                  disabled={acting === "launch"}
                  onClick={props.handleLaunch}
                  className="rounded-md px-3 py-1.5 bg-emerald-700 text-white text-sm disabled:opacity-50"
                >
                  {acting === "launch" ? "Запуск…" : "Запустить тренировку"}
                </button>
              )}

              {(ev.status === "DRAFT" || ev.status === "CANCELLED") && (
                <button
                  disabled={acting === "delete"}
                  onClick={props.handleDelete}
                  className="rounded-md px-3 py-1.5 bg-red-600 text-white text-sm disabled:opacity-50"
                >
                  {acting === "delete" ? "Удаление…" : "Удалить"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <span className="text-gray-500">Начало:</span>
            <br />
            {new Date(ev.startsAt).toLocaleString()}
          </div>
          <div>
            <span className="text-gray-500">Длительность:</span>
            <br />
            {ev.durationMin} мин
          </div>
          <div>
            <span className="text-gray-500">Вместимость:</span>
            <br />
            {ev.capacity ?? "—"}
          </div>
          <div>
            <span className="text-gray-500">Лист ожидания:</span>
            <br />
            {ev.waitlistEnabled ? "вкл" : "выкл"}
          </div>
        </div>

        {(ev as any).launchedAt && (
          <div className="mt-3 text-sm">
            <span className="text-gray-500">Запуск тренировки:</span>{" "}
            {new Date((ev as any).launchedAt).toLocaleString()}
          </div>
        )}

        {ev.description && (
          <div className="mt-4">
            <div className="text-gray-500 text-sm mb-1">Описание</div>
            <div className="whitespace-pre-wrap">{ev.description}</div>
          </div>
        )}
      </div>

      {/* ✅ Организатор: подтвержденные всегда видны, заявки по кнопке */}
      {showOrganizerPanel && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600">Я организатор</div>

            <button
              onClick={() => setAppsOpen((v) => !v)}
              className="rounded-md px-3 py-1.5 text-sm border"
              disabled={appsLoading}
            >
              {appsOpen ? "Скрыть заявки" : `Показать заявки (${requestsCount})`}
            </button>
          </div>

          <div className="text-sm text-gray-700">
            Подтверждено: {confirmedUsers.length}/{ev.capacity ?? "—"} · Лист ожидания:{" "}
            {waitlistedUsers.length}
          </div>

          {/* ✅ ВСЕГДА видимый блок подтвержденных */}
          <div className="pt-2">
            <div className="font-medium">Подтвержденные участники {confirmedUsers.length}</div>

            {appsLoading ? (
              <div className="text-sm text-gray-500 mt-2">Загрузка…</div>
            ) : confirmedUsers.length === 0 ? (
              <div className="text-sm text-gray-500 mt-2">Список пуст.</div>
            ) : (
              <div className="space-y-2 mt-2">
                {confirmedUsers.map((u) => (
                  <div key={u.userId} className="border rounded-md p-2 text-sm">
                    {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ✅ раскрываем только заявки/ожидание/отклонено */}
          {appsOpen && !appsLoading && (
            <div className="pt-2 space-y-4">
              <div>
                <div className="font-medium">На рассмотрении {pendingUsers.length}</div>
                {pendingUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 mt-1">Список пуст.</div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {pendingUsers.map((u) => (
                      <div key={u.userId} className="border rounded-md p-2 text-sm">
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium">Лист ожидания {waitlistedUsers.length}</div>
                {waitlistedUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 mt-1">Список пуст.</div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {waitlistedUsers.map((u) => (
                      <div key={u.userId} className="border rounded-md p-2 text-sm">
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium">Отклонено {declinedUsers.length}</div>
                {declinedUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 mt-1">Список пуст.</div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {declinedUsers.map((u) => (
                      <div key={u.userId} className="border rounded-md p-2 text-sm">
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AFTER FLOW */}
      {showAfter && (
        <div className="rounded-xl border p-4 space-y-4">
          <div className="text-lg font-semibold">После тренировки</div>

          {!isOrganizer && (
            <>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Посещаемость</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMy("ATTENDED")}
                    className={`rounded-md px-3 py-1.5 text-sm border ${
                      myAttendance === "ATTENDED" ? "bg-black text-white" : ""
                    }`}
                  >
                    Я пришёл
                  </button>
                  <button
                    onClick={() => setMy("ABSENT")}
                    className={`rounded-md px-3 py-1.5 text-sm border ${
                      myAttendance === "ABSENT" ? "bg-black text-white" : ""
                    }`}
                  >
                    Не пришёл
                  </button>
                </div>
                {myAttendance === "ABSENT" && (
                  <div className="text-sm text-gray-500">Если отметили “Не пришёл”, оценку оставить нельзя.</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-600">Оценить организатора</div>
                <div className="flex items-center gap-2">
                  <select
                    value={ratingOrg}
                    onChange={(e) => setRatingOrg(Number(e.target.value))}
                    className="border rounded-md px-2 py-1 text-sm"
                    disabled={myAttendance !== "ATTENDED"}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={savingOrgReview || myAttendance !== "ATTENDED"}
                    onClick={rateOrganizer}
                    className="rounded-md px-3 py-1.5 bg-black text-white text-sm disabled:opacity-50"
                  >
                    {savingOrgReview ? "Отправка…" : "Отправить"}
                  </button>
                </div>
                <textarea
                  value={commentOrg}
                  onChange={(e) => setCommentOrg(e.target.value)}
                  placeholder="Комментарий (необязательно)"
                  className="w-full border rounded-md p-2 text-sm"
                  disabled={myAttendance !== "ATTENDED"}
                />
              </div>
            </>
          )}

          {isOrganizer && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">Подтверждённые участники</div>

              {confirmedUsers.length === 0 ? (
                <div className="text-sm text-gray-500">Пока нет участников.</div>
              ) : (
                <div className="space-y-2">
                  {confirmedUsers.map((p) => (
                    <div key={p.userId} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.userId}</div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                          <button
                            disabled={savingRow[p.userId]}
                            onClick={() => markAttendanceFor(p.userId, "ATTENDED")}
                            className="rounded-md px-3 py-1.5 text-sm border"
                          >
                            Пришёл
                          </button>
                          <button
                            disabled={savingRow[p.userId]}
                            onClick={() => markAttendanceFor(p.userId, "ABSENT")}
                            className="rounded-md px-3 py-1.5 text-sm border"
                          >
                            Не пришёл
                          </button>
                        </div>

                        <div className="flex gap-2 items-center">
                          <select
                            className="border rounded-md px-2 py-1 text-sm"
                            defaultValue={5}
                            disabled={savingRow[p.userId]}
                            onChange={(e) => rateParticipant(p.userId, Number(e.target.value))}
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                Оценка {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <Link to="/map" className="text-sm text-blue-700 hover:underline">
          ← Вернуться на карту
        </Link>
      </div>
    </div>
  );
}
