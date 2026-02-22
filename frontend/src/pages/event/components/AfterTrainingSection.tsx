import React from "react";
import { applicationsByEvent } from "@/entities/application/api";
import { getUser } from "@/entities/user/api";
import type { AttendanceResponse, AttendanceStatus } from "@/entities/attendance/types";
import { createReview, listReviewsByEventAll } from "@/entities/review/api";
import type { Event } from "@/entities/event/types";
import {
  getMyAttendance,
  listAttendance,
  listRateableUserIds,
  setAttendanceForUser,
} from "@/entities/attendance/api";
import AvatarCircle from "@/shared/AvatarCircle";

type Person = { userId: string; name: string; email?: string | null; avatarUrl?: string | null };

function endsAtMs(ev: any) {
  const baseStr = (ev as any).launchedAt ?? ev.launchedAt ?? ev.startsAt;
  const base = Date.parse(baseStr || "");
  const dur = Number((ev as any).durationMin ?? 60);
  if (!Number.isFinite(base)) return NaN;
  return base + dur * 60 * 1000;
}

export default function AfterTrainingSection({
  ev,
  isOrganizer,
  meId,
}: {
  ev: Event;
  isOrganizer: boolean;
  meId: string | null;
}) {
  const launchedAt = (ev as any).launchedAt ?? ev.launchedAt ?? null;
  const isLaunched = Boolean(launchedAt);
  const status = String(ev.status || "").toUpperCase();

  // Показываем блок после запуска (или после завершения) — и организатору, и участникам.
  const showAfter = Boolean(meId) && status !== "CANCELLED" && (isLaunched || status === "FINISHED");
  if (!showAfter) return null;

  const organizerId = String((ev as any).organizerId);

  // Оценки доступны после завершения (либо после manual finish, либо после окончания по времени)
  const nowMs = Date.now();
  const endMs = endsAtMs(ev as any);
  const canRateNow = status === "FINISHED" || (Number.isFinite(endMs) ? nowMs > endMs : false);

  // --- UI классы
  const btnBase =
    "rounded-md px-3 py-1.5 text-sm transition duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 disabled:opacity-50 disabled:cursor-not-allowed";
  const btnOutline = `${btnBase} border hover:bg-gray-50`;
  const btnSolid = `${btnBase} bg-black text-white hover:bg-black/90`;
  const rangeBase = "accent-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40";

  // --- ratings
  const [ratingByUser, setRatingByUser] = React.useState<Record<string, number>>({});
  const getRating = (userId: string) => ratingByUser[userId] ?? 5;
  const setRating = (userId: string, value: number) => {
    setRatingByUser((m) => ({ ...m, [userId]: value }));
  };

  // --- organizer comment for organizer rating
  const [commentOrg, setCommentOrg] = React.useState("");

  // --- people
  const [people, setPeople] = React.useState<Person[]>([]);

  // organizer flow
  const [savingRow, setSavingRow] = React.useState<Record<string, boolean>>({});
  const [attendanceByUser, setAttendanceByUser] = React.useState<Record<string, AttendanceStatus>>({});

  // manual refresh for participant (to avoid full page reload)
  const [refreshKey, setRefreshKey] = React.useState(0);

  // participant: my attendance (нужно для правила "оценка только после отметки организатором")
  const [myAttendance, setMyAttendance] = React.useState<AttendanceResponse | null>(null);

  // after sending review — lock
  const [reviewSentByUser, setReviewSentByUser] = React.useState<Record<string, boolean>>({});

  // --- organizer: load attendance list
  React.useEffect(() => {
    if (!isOrganizer) return;

    let ignore = false;
    (async () => {
      try {
        const rows = await listAttendance(ev.id);
        const map: Record<string, AttendanceStatus> = {};
        (rows ?? []).forEach((r: any) => {
          map[String(r.userId)] = r.status;
        });
        if (!ignore) setAttendanceByUser(map);
      } catch {
        // no-op
      }
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, isOrganizer]);

  // --- participant: load my attendance mark
  React.useEffect(() => {
    if (!meId) return;
    if (isOrganizer) return;

    let ignore = false;
    (async () => {
      try {
        const a = await getMyAttendance(ev.id);
        if (!ignore) setMyAttendance(a);
      } catch {
        // если отметки ещё нет — это нормально
        if (!ignore) setMyAttendance(null);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, meId, isOrganizer, refreshKey]);

  // Загрузка людей:
  // - организатору: confirmed заявки + organizer
  // - участнику: список "rateable" (появится только после отметки ATTENDED организатором)
  React.useEffect(() => {
    if (!meId) return;

    let ignore = false;
    (async () => {
      try {
        let ids: string[] = [];

        if (isOrganizer) {
          const pg = await applicationsByEvent(ev.id, 0, 200);
          const confirmed = (pg.content ?? []).filter((x: any) => String(x.status).toUpperCase() === "CONFIRMED");
          ids = confirmed.map((x: any) => String(x.userId));
          ids.push(organizerId);
        } else {
          // вернёт пустой список, пока организатор не отметил attendance (и меня тоже)
          const rateable = await listRateableUserIds(ev.id);
          ids = Array.isArray(rateable) ? rateable.map((x) => String(x)) : [];

          // чтобы UI не был пустым — хотя бы покажем организатора (кнопки будут disabled, пока нет отметки)
          if (ids.length === 0) ids = [organizerId];
        }

        const uniqueIds = Array.from(new Set(ids))
          .filter((uid) => uid)
          .filter((uid) => String(uid) !== String(meId));

        const users = await Promise.all(
          uniqueIds.map(async (uid) => {
            try {
              const u = await getUser(uid);
              const name = (u.displayName || u.email || "Пользователь").trim();
              return { userId: uid, name, email: u.email ?? null, avatarUrl: (u as any).avatarUrl ?? null } as Person;
            } catch {
              return { userId: uid, name: "Пользователь", email: null, avatarUrl: null } as Person;
            }
          })
        );

        if (!ignore) setPeople(users);
      } catch {
        if (!ignore) setPeople([]);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, organizerId, meId, isOrganizer, refreshKey]);

  // Загрузка уже отправленных мной отзывов, чтобы заблокировать кнопки после перезагрузки
  React.useEffect(() => {
    if (!meId) return;

    let ignore = false;
    (async () => {
      try {
        const pg = await listReviewsByEventAll(ev.id, 0, 200);
        const mine = (pg.content ?? []).filter((r: any) => String(r.authorId) === String(meId));
        const map: Record<string, boolean> = {};
        mine.forEach((r: any) => {
          map[String(r.targetId)] = true;
        });
        if (!ignore) setReviewSentByUser(map);
      } catch {
        // no-op
      }
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, meId]);

  const markAttendanceFor = async (userId: string, status: AttendanceStatus) => {
    setSavingRow((m) => ({ ...m, [userId]: true }));
    try {
      await setAttendanceForUser(ev.id, userId, status);
      setAttendanceByUser((m) => ({ ...m, [userId]: status }));
      alert("Посещаемость сохранена");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Не удалось сохранить посещаемость");
    } finally {
      setSavingRow((m) => ({ ...m, [userId]: false }));
    }
  };

  const rateUser = async (targetId: string, rating: number, comment: string | null) => {
    if (!meId) return;
    setSavingRow((m) => ({ ...m, [targetId]: true }));
    try {
      await createReview({ eventId: ev.id, targetId, rating, comment });
      setReviewSentByUser((m) => ({ ...m, [targetId]: true }));
      alert("Оценка отправлена");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось отправить оценку";
      // Если уже есть — просто блокируем UI
      if (String(msg).toLowerCase().includes("already") || String(msg).toLowerCase().includes("exists")) {
        setReviewSentByUser((m) => ({ ...m, [targetId]: true }));
      }
      alert(msg);
    } finally {
      setSavingRow((m) => ({ ...m, [targetId]: false }));
    }
  };

  const organizerPerson = people.find((p) => String(p.userId) === String(organizerId)) || null;
  const otherParticipants = people.filter((p) => String(p.userId) !== String(organizerId));

  // участник может оценивать только после отметки организатором: ATTENDED + markedBy == organizerId
  const canRateAsParticipant =
    !isOrganizer &&
    Boolean(myAttendance) &&
    myAttendance?.status === "ATTENDED" &&
    String(myAttendance?.markedBy || "") === String(organizerId);

  const anyUnmarked = isOrganizer && people.some((p) => !attendanceByUser[p.userId]);

  return (
    <div id="after" className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold">{isOrganizer ? "Управление участниками" : "После тренировки"}</div>
        {!isOrganizer && (
          <button className={btnOutline} onClick={() => setRefreshKey((x) => x + 1)}>
            Обновить
          </button>
        )}
      </div>

      {/* Участник */}
      {!isOrganizer && (
        <>
          {/* Оценка организатора */}
          {organizerPerson && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Оценить организатора</div>

              <div className="flex items-center gap-3 rounded-lg border p-3">
                <AvatarCircle
                  avatarUrl={organizerPerson.avatarUrl}
                  name={organizerPerson.name}
                  email={organizerPerson.email}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{organizerPerson.name}</div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={getRating(organizerPerson.userId)}
                    onChange={(e) => setRating(organizerPerson.userId, Number(e.target.value))}
                    className={`w-40 ${rangeBase}`}
                    disabled={!canRateNow || !canRateAsParticipant || reviewSentByUser[organizerPerson.userId]}
                  />
                  <div className="w-6 text-sm font-semibold">{getRating(organizerPerson.userId)}</div>

                  <button
                    disabled={!canRateNow || !canRateAsParticipant || reviewSentByUser[organizerPerson.userId]}
                    onClick={() => rateUser(organizerPerson.userId, getRating(organizerPerson.userId), commentOrg || null)}
                    className={btnSolid}
                  >
                    {reviewSentByUser[organizerPerson.userId] ? "Отправлено" : "Отправить"}
                  </button>
                </div>
              </div>

              <textarea
                value={commentOrg}
                onChange={(e) => setCommentOrg(e.target.value)}
                placeholder="Комментарий (необязательно)"
                className="w-full rounded-md border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
                disabled={!canRateNow || !canRateAsParticipant || (organizerPerson ? reviewSentByUser[organizerPerson.userId] : false)}
              />

              {!canRateNow && <div className="text-xs text-gray-500">Оценки откроются после завершения.</div>}
              {canRateNow && !canRateAsParticipant && (
                <div className="text-xs text-gray-500">Оценки откроются после отметки твоего присутствия организатором.</div>
              )}
              {myAttendance?.status === "ABSENT" && (
                <div className="text-xs text-gray-500">Ты отмечен как “Не пришёл” — оценивание недоступно.</div>
              )}
            </div>
          )}

          {/* Оценка других участников */}
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Оценить участников</div>

            {otherParticipants.length === 0 ? (
              <div className="text-sm text-gray-500">
                {!canRateNow
                  ? "Оценки откроются после завершения."
                  : !canRateAsParticipant
                  ? "Список участников появится после отметки твоего присутствия организатором."
                  : "Пока нет других участников для оценки."}
              </div>
            ) : (
              <div className="space-y-2">
                {otherParticipants.map((p) => {
                  const rowBusy = Boolean(savingRow[p.userId]);
                  const rated = Boolean(reviewSentByUser[p.userId]);
                  const canRate = canRateNow && canRateAsParticipant && !rowBusy && !rated;

                  return (
                    <div key={p.userId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarCircle avatarUrl={p.avatarUrl} name={p.name} email={p.email} size={40} />
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{p.name}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={1}
                          value={getRating(p.userId)}
                          onChange={(e) => setRating(p.userId, Number(e.target.value))}
                          className={`w-40 ${rangeBase}`}
                          disabled={!canRate}
                        />
                        <div className="w-6 text-sm font-semibold">{getRating(p.userId)}</div>

                        <button disabled={!canRate} onClick={() => rateUser(p.userId, getRating(p.userId), null)} className={btnSolid}>
                          {rated ? "Отправлено" : rowBusy ? "…" : "Отправить"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!canRateNow && <div className="text-xs text-gray-500">Оценки откроются после завершения.</div>}
                {canRateNow && !canRateAsParticipant && (
                  <div className="text-xs text-gray-500">Оценки откроются после отметки твоего присутствия организатором.</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Организатор */}
      {isOrganizer && (
        <div className="space-y-3">
          {(anyUnmarked || !canRateNow) && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Отметь, кто пришёл/не пришёл. Оценка доступна после завершения (или после окончания по времени) и после отметки “Пришёл”.
            </div>
          )}

          <div className="text-sm text-gray-600">Подтверждённые участники</div>

          {people.length === 0 ? (
            <div className="text-sm text-gray-500">Пока нет участников.</div>
          ) : (
            <div className="space-y-2">
              {people.map((p) => {
                const att = attendanceByUser[p.userId]; // "ATTENDED" | "ABSENT" | undefined
                const rowBusy = Boolean(savingRow[p.userId]);

                const attendanceLocked = Boolean(att);
                const rated = Boolean(reviewSentByUser[p.userId]);

                const canRateThisUser = canRateNow && att === "ATTENDED" && !rowBusy && !rated;

                return (
                  <div key={p.userId} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarCircle avatarUrl={p.avatarUrl} name={p.name} email={p.email} size={40} />
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{p.name}</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <button
                          disabled={rowBusy || attendanceLocked}
                          onClick={() => markAttendanceFor(p.userId, "ATTENDED")}
                          className={att === "ATTENDED" ? btnSolid : btnOutline}
                        >
                          Пришёл
                        </button>

                        <button
                          disabled={rowBusy || attendanceLocked}
                          onClick={() => markAttendanceFor(p.userId, "ABSENT")}
                          className={att === "ABSENT" ? btnSolid : btnOutline}
                        >
                          Не пришёл
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={1}
                          value={getRating(p.userId)}
                          onChange={(e) => setRating(p.userId, Number(e.target.value))}
                          className={`w-40 ${rangeBase}`}
                          disabled={!canRateThisUser}
                        />
                        <div className="w-6 text-sm font-semibold">{getRating(p.userId)}</div>

                        <button
                          disabled={!canRateThisUser}
                          onClick={() => rateUser(p.userId, getRating(p.userId), null)}
                          className={btnSolid}
                        >
                          {rated ? "Отправлено" : rowBusy ? "…" : "Отправить"}
                        </button>
                      </div>

                      {att === "ABSENT" && <div className="text-xs text-gray-500">Отмечен как “Не пришёл” — без оценки.</div>}
                      {!att && <div className="text-xs text-gray-500">Сначала отметь посещаемость.</div>}
                      {attendanceLocked && <div className="text-xs text-gray-500">Посещаемость сохранена.</div>}
                      {rated && <div className="text-xs text-gray-500">Оценка отправлена.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
