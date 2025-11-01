import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getEvent, cancelEvent, deleteEvent } from "@/entities/event/api";
import type { Event } from "@/entities/event/types";
import { useEventStore } from "@/entities/event/store";
import { useAuthStore } from "@/features/auth/store";

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export default function EventDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [ev, setEv] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"cancel" | "delete" | null>(null);

  // auth (ожидаем, что в сторе есть user?.id; если нет — кнопки просто не появятся)
  const meId = useAuthStore((s: any) => s.user?.id || s.profile?.id || s.me?.id || null);

  // методы стора событий, чтобы карта/список были в консистентном состоянии
  const upsert = useEventStore(s => s.upsert ?? (() => {}));
  const remove = useEventStore(s => s.remove ?? (() => {}));

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
    return () => { ignore = true; };
  }, [id]);

  const isOrganizer = useMemo(() => {
    if (!ev || !meId) return false;
    return String(ev.organizerId) === String(meId);
  }, [ev, meId]);

  if (loading) {
    return <div className="p-6">Загрузка…</div>;
  }
  if (!ev) {
    return <div className="p-6">Событие не найдено.</div>;
  }

  const statusColor =
    ev.status === "CANCELLED" ? "bg-red-100 text-red-700" :
    ev.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" :
    "bg-gray-100 text-gray-700";

    const handleCancel = async () => {
    if (!confirm("Отменить событие? Участники больше не смогут записываться.")) return;
    setActing("cancel");
    try {
        await cancelEvent(ev.id);
        // локально обновим карточку
        const updated: Event = { ...ev, status: "CANCELLED" };
        setEv(updated);
        // и стор — быстрым методом
        useEventStore.getState().updateStatus(ev.id, "CANCELLED");
    } finally {
        setActing(null);
    }
    };

  const handleDelete = async () => {
    if (!confirm("Удалить черновик безвозвратно?")) return;
    setActing("delete");
    try {
      await deleteEvent(ev.id);
      remove(ev.id);
      navigate("/map", { replace: true });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{ev.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge className={statusColor}>{ev.status}</Badge>
            <Badge className="bg-blue-100 text-blue-700">{ev.kind}</Badge>
            <Badge className="bg-slate-100 text-slate-700">{ev.sport}</Badge>
            <Badge className="bg-violet-100 text-violet-700">{ev.admission}</Badge>
            <Badge className="bg-amber-100 text-amber-700">{ev.access}</Badge>
          </div>
          {ev.locationLat != null && ev.locationLon != null && (
            <div className="text-sm text-gray-600 mt-1">
              Координаты: {ev.locationLat?.toFixed(6)}, {ev.locationLon?.toFixed(6)}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {isOrganizer && (
            <>
              <Link
                to={`/event/${ev.id}/edit`}
                className="rounded-md px-3 py-1.5 bg-black text-white text-sm"
              >
                Редактировать
              </Link>

              {ev.status === "PUBLISHED" && (
                <button
                  disabled={acting === "cancel"}
                  onClick={handleCancel}
                  className="rounded-md px-3 py-1.5 bg-orange-600 text-white text-sm disabled:opacity-50"
                >
                  {acting === "cancel" ? "Отмена…" : "Отменить"}
                </button>
              )}

              {ev.status === "DRAFT" && (
                <button
                  disabled={acting === "delete"}
                  onClick={handleDelete}
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
          <div><span className="text-gray-500">Начало:</span><br/>{new Date(ev.startsAt).toLocaleString()}</div>
          <div><span className="text-gray-500">Длительность:</span><br/>{ev.durationMin} мин</div>
          <div><span className="text-gray-500">Вместимость:</span><br/>{ev.capacity ?? "—"}</div>
          <div><span className="text-gray-500">Лист ожидания:</span><br/>{ev.waitlistEnabled ? "вкл" : "выкл"}</div>
        </div>

        {ev.description && (
          <div className="mt-4">
            <div className="text-gray-500 text-sm mb-1">Описание</div>
            <div className="whitespace-pre-wrap">{ev.description}</div>
          </div>
        )}
      </div>

      <div>
        <Link to="/map" className="text-sm text-blue-700 hover:underline">← Вернуться на карту</Link>
      </div>
    </div>
  );
}
