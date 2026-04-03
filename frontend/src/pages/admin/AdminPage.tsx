import { useEffect, useMemo, useState } from "react";
import {
  adminBlockUser,
  adminDeleteEvent,
  adminHideEvent,
  adminListEvents,
  adminListUsers,
  adminPublishEvent,
  adminSummary,
  adminUnblockUser,
} from "@/entities/admin/api";
import type { AdminEvent, AdminSummary, AdminUser, PageResponse } from "@/entities/admin/types";
import { toast } from "@/shared/ui/toast/toast";

type Tab = "users" | "events";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");

  const [summary, setSummary] = useState<AdminSummary | null>(null);

  const [users, setUsers] = useState<PageResponse<AdminUser> | null>(null);
  const [events, setEvents] = useState<PageResponse<AdminEvent> | null>(null);
  const [eventStatus, setEventStatus] = useState<string>("");

  const [loading, setLoading] = useState(false);

  const statusOptions = useMemo(
    () => ["", "DRAFT", "PUBLISHED", "STARTED", "FINISHED", "CANCELLED"],
    []
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [s, u, e] = await Promise.all([
        adminSummary(),
        adminListUsers(0, 20),
        adminListEvents(eventStatus || undefined, 0, 20),
      ]);
      setSummary(s);
      setUsers(u);
      setEvents(e);
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка загрузки админки");
    } finally {
      setLoading(false);
    }
  }

  async function reloadUsers(page = 0) {
    setLoading(true);
    try {
      setUsers(await adminListUsers(page, 20));
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }

  async function reloadEvents(page = 0, status?: string) {
    setLoading(true);
    try {
      setEvents(await adminListEvents(status ?? (eventStatus || undefined), page, 20));
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка загрузки событий");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // если фильтр статуса поменяли — перегружаем список событий
  useEffect(() => {
    reloadEvents(0, eventStatus || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventStatus]);

  const s = summary;

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold">Администрирование</div>
            <div className="text-sm opacity-70">Блокировка пользователей и модерация событий</div>
          </div>
          <button
            onClick={() => loadAll()}
            className="rounded border px-3 py-1"
            disabled={loading}
          >
            Обновить
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border p-3">
            <div className="text-sm opacity-70">Пользователи</div>
            <div className="text-xl font-bold">{s?.userCount ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-sm opacity-70">События</div>
            <div className="text-xl font-bold">{s?.eventCount ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-sm opacity-70">Заявки</div>
            <div className="text-xl font-bold">{s?.applicationCount ?? "—"}</div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            className={`rounded-full border px-3 py-1 ${tab === "users" ? "bg-black text-white" : ""}`}
            onClick={() => setTab("users")}
          >
            Пользователи
          </button>
          <button
            className={`rounded-full border px-3 py-1 ${tab === "events" ? "bg-black text-white" : ""}`}
            onClick={() => setTab("events")}
          >
            События
          </button>
        </div>

        {tab === "users" ? (
          <div className="mt-4 rounded-xl border overflow-hidden">
            <div className="px-3 py-2 border-b font-semibold">Пользователи</div>

            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Имя</th>
                    <th className="text-left p-2">Роль</th>
                    <th className="text-left p-2">Статус</th>
                    <th className="text-left p-2">Создан</th>
                    <th className="text-left p-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {(users?.content ?? []).map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-2">{u.email}</td>
                      <td className="p-2">{u.displayName}</td>
                      <td className="p-2">{u.role}</td>
                      <td className="p-2">
                        {u.blocked ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5">BLOCKED</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5">ACTIVE</span>
                        )}
                      </td>
                      <td className="p-2">{new Date(u.createdAt).toLocaleString()}</td>
                      <td className="p-2">
                        {u.role === "ADMIN" ? (
                          <span className="opacity-60">—</span>
                        ) : u.blocked ? (
                          <button
                            className="rounded border px-2 py-1"
                            disabled={loading}
                            onClick={async () => {
                              try {
                                await adminUnblockUser(u.id);
                                toast.success("Пользователь разблокирован");
                                await reloadUsers(users?.page ?? 0);
                              } catch (err: any) {
                                toast.error(err?.message ?? "Ошибка");
                              }
                            }}
                          >
                            Разблокировать
                          </button>
                        ) : (
                          <button
                            className="rounded border px-2 py-1"
                            disabled={loading}
                            onClick={async () => {
                              if (!window.confirm(`Заблокировать пользователя ${u.email}?`)) return;
                              try {
                                await adminBlockUser(u.id);
                                toast.success("Пользователь заблокирован");
                                await reloadUsers(users?.page ?? 0);
                              } catch (err: any) {
                                toast.error(err?.message ?? "Ошибка");
                              }
                            }}
                          >
                            Заблокировать
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-sm opacity-70">
                Страница {((users?.page ?? 0) + 1)} / {users?.totalPages ?? 1}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border px-3 py-1"
                  disabled={loading || !users || users.page <= 0}
                  onClick={() => reloadUsers((users?.page ?? 0) - 1)}
                >
                  Назад
                </button>
                <button
                  className="rounded border px-3 py-1"
                  disabled={loading || !users || users.last}
                  onClick={() => reloadUsers((users?.page ?? 0) + 1)}
                >
                  Вперёд
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
              <div className="font-semibold">События / тренировки</div>
              <div className="flex items-center gap-2">
                <div className="text-sm opacity-70">Статус:</div>
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={eventStatus}
                  onChange={(e) => setEventStatus(e.target.value)}
                >
                  {statusOptions.map((x) => (
                    <option key={x || "ALL"} value={x}>
                      {x || "ALL"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[1050px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Название</th>
                    <th className="text-left p-2">Вид</th>
                    <th className="text-left p-2">Спорт</th>
                    <th className="text-left p-2">Дата</th>
                    <th className="text-left p-2">Статус</th>
                    <th className="text-left p-2">Организатор</th>
                    <th className="text-left p-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {(events?.content ?? []).map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-2">{e.title}</td>
                      <td className="p-2">{e.kind}</td>
                      <td className="p-2">{e.sport}</td>
                      <td className="p-2">{new Date(e.startsAt).toLocaleString()}</td>
                      <td className="p-2">{e.status}</td>
                      <td className="p-2">
                        <span className="font-mono text-xs">{e.organizerId.slice(0, 8)}…</span>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-2">
                          {e.status !== "DRAFT" && (
                            <button
                              className="rounded border px-2 py-1"
                              disabled={loading}
                              onClick={async () => {
                                if (!window.confirm("Снять с публикации (скрыть) это событие?")) return;
                                try {
                                  await adminHideEvent(e.id);
                                  toast.success("Снято с публикации");
                                  await reloadEvents(events?.page ?? 0);
                                } catch (err: any) {
                                  toast.error(err?.message ?? "Ошибка");
                                }
                              }}
                            >
                              Скрыть
                            </button>
                          )}

                          {e.status !== "PUBLISHED" && (
                            <button
                              className="rounded border px-2 py-1"
                              disabled={loading}
                              onClick={async () => {
                                try {
                                  await adminPublishEvent(e.id);
                                  toast.success("Опубликовано");
                                  await reloadEvents(events?.page ?? 0);
                                } catch (err: any) {
                                  toast.error(err?.message ?? "Ошибка");
                                }
                              }}
                            >
                              Опубликовать
                            </button>
                          )}

                          <button
                            className="rounded border px-2 py-1"
                            disabled={loading}
                            onClick={async () => {
                              if (!window.confirm("Удалить событие? Это удалит заявки/отзывы/посещаемость.")) return;
                              try {
                                await adminDeleteEvent(e.id);
                                toast.success("Удалено");
                                await reloadEvents(events?.page ?? 0);
                              } catch (err: any) {
                                toast.error(err?.message ?? "Ошибка");
                              }
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-sm opacity-70">
                Страница {((events?.page ?? 0) + 1)} / {events?.totalPages ?? 1}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border px-3 py-1"
                  disabled={loading || !events || events.page <= 0}
                  onClick={() => reloadEvents((events?.page ?? 0) - 1)}
                >
                  Назад
                </button>
                <button
                  className="rounded border px-3 py-1"
                  disabled={loading || !events || events.last}
                  onClick={() => reloadEvents((events?.page ?? 0) + 1)}
                >
                  Вперёд
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
