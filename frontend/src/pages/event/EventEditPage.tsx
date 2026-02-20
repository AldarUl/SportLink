import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getEvent, updateEvent } from "@/entities/event/api";
import { listSports } from "@/entities/sport/api";
import { normalizeSportCode } from "@/shared/lib/sport";
import { useEventStore } from "@/entities/event/store";
import { useAuthStore } from "@/features/auth/store";
import type { Event, EventAccess, EventAdmission } from "@/entities/event/types";

export default function EventEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const upsert = useEventStore(s => s.upsert);
  const { user } = useAuthStore();

  const [evt, setEvt] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(""); // datetime-local
  const [durationMin, setDurationMin] = useState<number>(60);
  const [capacity, setCapacity] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState<string>("");
  const [access, setAccess] = useState<EventAccess>("PUBLIC");
  const [admission, setAdmission] = useState<EventAdmission>("AUTO");
  const [waitlistEnabled, setWaitlistEnabled] = useState<boolean>(false);
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLon, setLocationLon] = useState<number | undefined>(undefined);
  const [sports, setSports] = useState<{code:string;name:string}[]>([]);


  useEffect(() => {
    listSports().then(setSports).catch(() => setSports([]));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const e = await getEvent(id);
        setEvt(e);

        // ownership check
        if (user && String(user.id) !== String(e.organizerId)) {
          setErr("Недостаточно прав для редактирования этого события.");
          setLoading(false);
          return;
        }

        // fill form
        setTitle(e.title || "");
        setSport(e.sport || "");
        setStartsAtLocal(isoToLocal(e.startsAt));
        setDurationMin(e.durationMin ?? 60);
        setCapacity(e.capacity);
        setDescription(e.description || "");
        setAccess(e.access);
        setAdmission(e.admission);
        setWaitlistEnabled(Boolean(e.waitlistEnabled));
        setLocationLat(e.locationLat ?? undefined);
        setLocationLon(e.locationLon ?? undefined);
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Не удалось загрузить событие");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const canSubmit = useMemo(() => title.trim().length > 0 && sport.trim().length > 0, [title, sport]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!evt || !canSubmit) return;

    const patch: Partial<Event> = {
      title: title.trim(),
      sport: normalizeSportCode(sport),
      startsAt: localToIso(startsAtLocal),
      durationMin,
      capacity,
      description: description.trim() || null,
      access,
      admission,
      waitlistEnabled,
      locationLat,
      locationLon,
    };

    const updated = await updateEvent(evt.id, patch);
    upsert(updated);
    navigate(`/event/${evt.id}`);
  };

  if (loading) return <div className="p-4">Загрузка…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!evt) return <div className="p-4">Событие не найдено</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Редактирование: {evt.title}</h1>
        <div className="flex gap-2">
          <Link to={`/event/${evt.id}`} className="rounded border px-3 py-1">Отмена</Link>
          <button
            form="event-edit"
            type="submit"
            disabled={!canSubmit}
            className="rounded bg-black text-white px-3 py-1 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>

      <form id="event-edit" onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
        <L label="Название">
          <input className="w-full border rounded px-3 py-2"
            value={title} onChange={e => setTitle(e.target.value)} />
        </L>

        <L label="Вид спорта">
          <select className="w-full border rounded px-3 py-2"
            value={sport}
            onChange={e => setSport(e.target.value)}>
            {(sports && sports.length ? sports : [{code: sport, name: sport}]).map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </L>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <L label="Начало">
            <input type="datetime-local" className="w-full border rounded px-3 py-2"
              value={startsAtLocal} onChange={e => setStartsAtLocal(e.target.value)} />
          </L>
          <L label="Длительность (мин)">
            <input type="number" min={1} className="w-full border rounded px-3 py-2"
              value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} />
          </L>
          <L label="Вместимость">
            <input type="number" min={0} className="w-full border rounded px-3 py-2"
              value={capacity ?? ""} onChange={e => {
                const v = e.target.value;
                setCapacity(v === "" ? undefined : Number(v));
              }} />
          </L>
        </div>

        <L label="Описание">
          <textarea className="w-full border rounded px-3 py-2 min-h-[100px]"
            value={description} onChange={e => setDescription(e.target.value)} />
        </L>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <L label="Доступ">
            <select className="w-full border rounded px-3 py-2"
              value={access} onChange={e => setAccess(e.target.value as EventAccess)}>
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </L>

          <L label="Приём заявок">
            <select className="w-full border rounded px-3 py-2"
              value={admission} onChange={e => setAdmission(e.target.value as EventAdmission)}>
              <option value="AUTO">AUTO</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </L>

          <L label="Лист ожидания">
            <label className="inline-flex items-center gap-2 px-2 py-2 border rounded">
              <input type="checkbox" checked={waitlistEnabled}
                onChange={e => setWaitlistEnabled(e.target.checked)} />
              <span>Включить</span>
            </label>
          </L>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <L label="Широта (lat)">
            <input type="number" step="0.000001" className="w-full border rounded px-3 py-2"
              value={locationLat ?? ""} onChange={e => {
                const v = e.target.value;
                setLocationLat(v === "" ? undefined : Number(v));
              }} />
          </L>
          <L label="Долгота (lon)">
            <input type="number" step="0.000001" className="w-full border rounded px-3 py-2"
              value={locationLon ?? ""} onChange={e => {
                const v = e.target.value;
                setLocationLon(v === "" ? undefined : Number(v));
              }} />
          </L>
        </div>
      </form>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

// ISO ⇄ datetime-local helpers
function isoToLocal(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}
function localToIso(local: string) {
  try {
    // treat as local time, convert to ISO (browser will apply TZ)
    const d = new Date(local);
    return d.toISOString();
  } catch {
    return local;
  }
}
