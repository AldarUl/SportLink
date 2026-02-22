import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getEvent, cancelEvent, launchEvent, finishEvent } from "@/entities/event/api";
import type { Event } from "@/entities/event/types";
import { useEventStore } from "@/entities/event/store";
import { useAuthStore } from "@/features/auth/store";
import { getApiErrorMessage } from "@/shared/lib/apiError";
import EventDetailView from "./EventDetailView";




export default function EventDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [ev, setEv] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"cancel" | "delete" | "launch" | "finish" | null>(null);

  const meId = useAuthStore((s: any) => s.user?.id || null);

  const updateStatus = useEventStore((s) => s.updateStatus);
  const deleteById = useEventStore((s) => s.deleteById);
  const upsert = useEventStore((s) => s.upsert);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await getEvent(id);
        if (!ignore) setEv(data);
      } catch (e) {
        if (!ignore) alert(getApiErrorMessage(e, "Событие не найдено"));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  // если пришли с map-попапа (или после запуска) — прокручиваем к блоку управления
  useEffect(() => {
    if (!ev) return;
    const qs = new URLSearchParams(location.search);
    const manage = qs.get("manage") === "1";
    if (manage || location.hash === "#after") {
      setTimeout(() => {
        document.getElementById("after")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }, [ev?.id, location.search, location.hash]);

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
    } catch (e) {
      alert(getApiErrorMessage(e, "Не удалось отменить"));
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
    } catch (e) {
      alert(getApiErrorMessage(e, "Не удалось удалить"));
    } finally {
      setActing(null);
    }
  };

  const handleLaunch = async () => {
    if (!confirm("Запустить тренировку/событие?")) return;
    setActing("launch");
    try {
      const updated = await launchEvent(ev.id);
      setEv(updated);
      upsert(updated);
      navigate(`/event/${ev.id}?manage=1#after`, { replace: true });
    } catch (e) {
      alert(getApiErrorMessage(e, "Не удалось запустить"));
    } finally {
      setActing(null);
    }
  };

  const handleFinish = async () => {
    if (!confirm("Завершить тренировку/событие? После этого откроются оценки.")) return;
    setActing("finish");
    try {
      const updated = await finishEvent(ev.id);
      setEv(updated);
      upsert(updated);
      navigate(`/event/${ev.id}?manage=1#after`, { replace: true });
    } catch (e) {
      alert(getApiErrorMessage(e, "Не удалось завершить"));
    } finally {
      setActing(null);
    }
  };

  return (
<EventDetailView
  ev={ev}
  isOrganizer={isOrganizer}
  meId={meId}
  statusColor={statusColor}
  acting={acting}
  onCancel={handleCancel}
  onDelete={handleDelete}
  onLaunch={handleLaunch}
  onFinish={handleFinish}
/>
  );
}
