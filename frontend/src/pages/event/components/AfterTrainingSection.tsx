import React from "react";
import { applicationsByEvent } from "@/entities/application/api";
import { getUser } from "@/entities/user/api";
import type { AttendanceStatus } from "@/entities/attendance/types";
import { createReview } from "@/entities/review/api";
import type { Event } from "@/entities/event/types";
import {
  getMyAttendance,
  setMyAttendance,
  setAttendanceForUser,
  listAttendance,
} from "@/entities/attendance/api";

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

  // Организатор: после запуска (STARTED/FINISHED)
  // Участник: только после завершения (FINISHED)
  const showAfter =
    Boolean(meId) &&
    ev.status !== "CANCELLED" &&
    (isOrganizer
      ? isLaunched && (ev.status === "STARTED" || ev.status === "FINISHED")
      : ev.status === "FINISHED");

  if (!showAfter) return null;

  const organizerId = String((ev as any).organizerId);

  // Оценка доступна после запуска (STARTED/FINISHED), но только если отмечено "Пришёл"
  const canRateNow = isLaunched && (ev.status === "STARTED" || ev.status === "FINISHED");

  // --- UI классы (анимации)
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

  // --- participant flow
  const [myAttendance, setMyAttendanceState] = React.useState<AttendanceStatus | null>(null);
  const [savingMy, setSavingMy] = React.useState(false);

  const [ratingOrg, setRatingOrg] = React.useState(5);
  const [commentOrg, setCommentOrg] = React.useState("");
  const [savingOrgReview, setSavingOrgReview] = React.useState(false);

  // После отправки оценки организатору — блокируем
  const [orgReviewSent, setOrgReviewSent] = React.useState(false);

  // --- organizer flow
  const [participants, setParticipants] = React.useState<Array<{ userId: string; name: string }>>(
    []
  );
  const [savingRow, setSavingRow] = React.useState<Record<string, boolean>>({});
  const [attendanceByUser, setAttendanceByUser] = React.useState<Record<string, AttendanceStatus>>(
    {}
  );

  // После отправки оценки участнику — блокируем
  const [reviewSentByUser, setReviewSentByUser] = React.useState<Record<string, boolean>>({});

  // Участник: загрузка моей посещаемости (после FINISHED)
  React.useEffect(() => {
    if (isOrganizer) return;
    if (ev.status !== "FINISHED") return;

    let ignore = false;
    (async () => {
      try {
        const a = await getMyAttendance(ev.id);
        if (!ignore) setMyAttendanceState(a?.status ?? null);
      } catch {
        if (!ignore) setMyAttendanceState(null);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, ev.status, isOrganizer]);

  // Организатор: загрузка attendance list (чтобы после перезагрузки всё не было пустым)
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
        // молча
      }
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, isOrganizer]);

  // Организатор: загрузка участников (confirmed)
  React.useEffect(() => {
    if (!isOrganizer) return;

    let ignore = false;
    (async () => {
      const pg = await applicationsByEvent(ev.id, 0, 200);
      const confirmed = (pg.content ?? []).filter((x: any) => x.status === "CONFIRMED");

      const ids = confirmed
        .map((x: any) => String(x.userId))
        .filter((uid: string) => uid && uid !== organizerId);

      const uniqueIds = Array.from(new Set(ids));
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

      if (!ignore) setParticipants(users);
    })();

    return () => {
      ignore = true;
    };
  }, [ev.id, isOrganizer, organizerId]);

  const setMy = async (status: AttendanceStatus) => {
    setSavingMy(true);
    try {
      const a = await setMyAttendance(ev.id, status);
      setMyAttendanceState(a.status);
    } finally {
      setSavingMy(false);
    }
  };

  const rateOrganizer = async () => {
    if (!meId) return;
    setSavingOrgReview(true);
    try {
      await createReview({
        eventId: ev.id,
        targetId: organizerId,
        rating: ratingOrg,
        comment: commentOrg || null,
      });

      setOrgReviewSent(true);
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
      setAttendanceByUser((m) => ({ ...m, [userId]: status }));
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
        targetId: userId,
        rating,
        comment: null,
      });

      setReviewSentByUser((m) => ({ ...m, [userId]: true }));
      alert("Оценка участнику отправлена");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Не удалось отправить оценку");
    } finally {
      setSavingRow((m) => ({ ...m, [userId]: false }));
    }
  };

  const anyUnmarked = isOrganizer && participants.some((p) => !attendanceByUser[p.userId]);

  return (
    <div id="after" className="space-y-4 rounded-xl border p-4">
      <div className="text-lg font-semibold">
        {isOrganizer ? "Управление участниками" : "После тренировки"}
      </div>

      {!isOrganizer && (
        <>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Посещаемость</div>

            <div className="flex gap-2">
              <button
                disabled={savingMy || myAttendance !== null}
                onClick={() => setMy("ATTENDED")}
                className={myAttendance === "ATTENDED" ? btnSolid : btnOutline}
              >
                Я пришёл
              </button>

              <button
                disabled={savingMy || myAttendance !== null}
                onClick={() => setMy("ABSENT")}
                className={myAttendance === "ABSENT" ? btnSolid : btnOutline}
              >
                Не пришёл
              </button>
            </div>

            {myAttendance === "ABSENT" && (
              <div className="text-sm text-gray-500">
                Если отметили “Не пришёл”, оценку оставить нельзя.
              </div>
            )}

            {myAttendance !== null && (
              <div className="text-xs text-gray-500">Посещаемость сохранена.</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">Оценить организатора</div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={ratingOrg}
                onChange={(e) => setRatingOrg(Number(e.target.value))}
                className={`w-56 ${rangeBase}`}
                disabled={myAttendance !== "ATTENDED" || orgReviewSent}
              />
              <div className="w-6 text-sm font-semibold">{ratingOrg}</div>

              <button
                disabled={savingOrgReview || myAttendance !== "ATTENDED" || orgReviewSent}
                onClick={rateOrganizer}
                className={btnSolid}
              >
                {orgReviewSent ? "Отправлено" : savingOrgReview ? "Отправка…" : "Отправить"}
              </button>
            </div>

            {orgReviewSent && <div className="text-xs text-gray-500">Оценка отправлена.</div>}

            <textarea
              value={commentOrg}
              onChange={(e) => setCommentOrg(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="w-full rounded-md border p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-50"
              disabled={myAttendance !== "ATTENDED" || orgReviewSent}
            />
          </div>
        </>
      )}

      {isOrganizer && (
        <div className="space-y-3">
          {(anyUnmarked || !canRateNow) && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Отметь, кто пришёл/не пришёл. Оценка доступна после запуска и после отметки “Пришёл”.
            </div>
          )}

          <div className="text-sm text-gray-600">Подтверждённые участники</div>

          {participants.length === 0 ? (
            <div className="text-sm text-gray-500">Пока нет участников.</div>
          ) : (
            <div className="space-y-2">
              {participants.map((p) => {
                const att = attendanceByUser[p.userId]; // "ATTENDED" | "ABSENT" | undefined
                const rowBusy = Boolean(savingRow[p.userId]);

                const attendanceLocked = Boolean(att); // уже отмечено?
                const rated = Boolean(reviewSentByUser[p.userId]); // уже оценено?

                const canRateThisUser = canRateNow && att === "ATTENDED" && !rowBusy && !rated;

                return (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.userId}</div>
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
                          onClick={() => rateParticipant(p.userId, getRating(p.userId))}
                          className={btnSolid}
                        >
                          {rated ? "Отправлено" : rowBusy ? "…" : "Отправить"}
                        </button>
                      </div>

                      {att === "ABSENT" && (
                        <div className="text-xs text-gray-500">
                          Отмечен как “Не пришёл” — без оценки.
                        </div>
                      )}

                      {!att && <div className="text-xs text-gray-500">Сначала отметь посещаемость.</div>}

                      {attendanceLocked && (
                        <div className="text-xs text-gray-500">Посещаемость сохранена.</div>
                      )}

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