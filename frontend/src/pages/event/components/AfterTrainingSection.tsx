import React from "react";
import { applicationsByEvent } from "@/entities/application/api";
import { getUser } from "@/entities/user/api";
import {
  getMyAttendance,
  setMyAttendance,
  setAttendanceForUser,
} from "@/entities/attendance/api";
import type { AttendanceStatus } from "@/entities/attendance/types";
import { createReview } from "@/entities/review/api";
import type { Event } from "@/entities/event/types";

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

  // Для организатора блок нужен сразу после ручного запуска.
  // Для участника — только после завершения.
  const showAfter = Boolean(meId) && ev.status !== "CANCELLED" && (
    isOrganizer
      ? (isLaunched && (ev.status === "STARTED" || ev.status === "FINISHED"))
      : (ev.status === "FINISHED")
  );
  if (!showAfter) return null;

  const organizerId = String((ev as any).organizerId);

  const baseIso = launchedAt ?? ev.startsAt;
  const baseMs = Date.parse(baseIso);
  const endsAtMs = baseMs + (ev.durationMin ?? 0) * 60 * 1000;
  const isFinishedByTime = Date.now() >= endsAtMs;

  const [myAttendance, setMyAttendanceState] = React.useState<AttendanceStatus | null>(null);
  const [ratingOrg, setRatingOrg] = React.useState(5);
  const [commentOrg, setCommentOrg] = React.useState("");
  const [savingOrgReview, setSavingOrgReview] = React.useState(false);

  const [participants, setParticipants] = React.useState<Array<{ userId: string; name: string }>>([]);
  const [savingRow, setSavingRow] = React.useState<Record<string, boolean>>({});
  const [attendanceByUser, setAttendanceByUser] = React.useState<Record<string, AttendanceStatus>>({});

  // загрузка моей посещаемости
  React.useEffect(() => {
    (async () => {
      try {
        const a = await getMyAttendance(ev.id);
        setMyAttendanceState(a?.status ?? null);
      } catch {
        setMyAttendanceState(null);
      }
    })();
  }, [ev.id]);

  // загрузка участников для организатора
  React.useEffect(() => {
    if (!isOrganizer) return;
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
      setParticipants(users);
    })();
  }, [ev.id, isOrganizer, organizerId]);

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
        targetUserId: organizerId,
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
                onClick={() => setMy("ATTENDED")}
                className={`rounded-md border px-3 py-1.5 text-sm ${myAttendance === "ATTENDED" ? "bg-black text-white" : ""}`}
              >
                Я пришёл
              </button>
              <button
                onClick={() => setMy("ABSENT")}
                className={`rounded-md border px-3 py-1.5 text-sm ${myAttendance === "ABSENT" ? "bg-black text-white" : ""}`}
              >
                Не пришёл
              </button>
            </div>
            {myAttendance === "ABSENT" && (
              <div className="text-sm text-gray-500">
                Если отметили “Не пришёл”, оценку оставить нельзя.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">Оценить организатора</div>
            <div className="flex items-center gap-2">
              <select
                value={ratingOrg}
                onChange={(e) => setRatingOrg(Number(e.target.value))}
                className="rounded-md border px-2 py-1 text-sm"
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
                className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {savingOrgReview ? "Отправка…" : "Отправить"}
              </button>
            </div>
            <textarea
              value={commentOrg}
              onChange={(e) => setCommentOrg(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="w-full rounded-md border p-2 text-sm"
              disabled={myAttendance !== "ATTENDED"}
            />
          </div>
        </>
      )}

      {isOrganizer && (
        <div className="space-y-3">
          {!isFinishedByTime && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Отметь, кто пришёл/не пришёл. Оценка участников станет доступна после окончания тренировки.
            </div>
          )}
          <div className="text-sm text-gray-600">Подтверждённые участники</div>

          {participants.length === 0 ? (
            <div className="text-sm text-gray-500">Пока нет участников.</div>
          ) : (
            <div className="space-y-2">
              {participants.map((p) => (
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
                        disabled={savingRow[p.userId]}
                        onClick={() => markAttendanceFor(p.userId, "ATTENDED")}
                        className="rounded-md border px-3 py-1.5 text-sm"
                      >
                        Пришёл
                      </button>
                      <button
                        disabled={savingRow[p.userId]}
                        onClick={() => markAttendanceFor(p.userId, "ABSENT")}
                        className="rounded-md border px-3 py-1.5 text-sm"
                      >
                        Не пришёл
                      </button>
                    </div>

                    <select
                      className="rounded-md border px-2 py-1 text-sm"
                      defaultValue={5}
                      disabled={
                        savingRow[p.userId] ||
                        !isFinishedByTime ||
                        attendanceByUser[p.userId] !== "ATTENDED"
                      }
                      onChange={(e) => rateParticipant(p.userId, Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          Оценка {n}
                        </option>
                      ))}
                    </select>

                    {attendanceByUser[p.userId] === "ABSENT" && (
                      <div className="text-xs text-gray-500">Отмечен как “Не пришёл” — без оценки.</div>
                    )}
                    {attendanceByUser[p.userId] !== "ATTENDED" && attendanceByUser[p.userId] !== "ABSENT" && (
                      <div className="text-xs text-gray-500">Сначала отметь посещаемость.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
