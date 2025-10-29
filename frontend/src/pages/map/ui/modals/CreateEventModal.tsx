import React, { useMemo, useState } from "react";
import { http } from "@/api/http";
import type { LngLat } from "../../lib/geo";

type Props = {
  open: boolean;
  kind: "EVENT" | "TRAINING";
  coords: LngLat;                // [lon, lat]
  onClose: () => void;
  onCreated?: () => void;        // колбэк после успешного создания
};

type CreatePayload = {
  kind: "EVENT" | "TRAINING";
  access: "PUBLIC" | "PRIVATE" | "CLUB_ONLY";
  admission: "AUTO" | "MANUAL";
  title: string;
  sport: string;
  startsAt: string;
  durationMin: number;
  capacity: number;
  waitlistEnabled: boolean;
  locationLat: number;
  locationLon: number;
  description?: string | null;
};

export const CreateEventModal: React.FC<Props> = ({ open, kind, coords, onClose, onCreated }) => {
  if (!open) return null;

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [access, setAccess] = useState<"PUBLIC" | "PRIVATE" | "CLUB_ONLY">("PUBLIC");
  const [admission, setAdmission] = useState<"AUTO" | "MANUAL">("AUTO");
  const [durationMin, setDurationMin] = useState(60);
  const [capacity, setCapacity] = useState(10);
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lon, lat] = coords;
  const defaultStartISO = useMemo(() => {
    const dt = new Date();
    dt.setMinutes(dt.getMinutes() + 15);
    return dt.toISOString();
  }, []);
  const [startsAt, setStartsAt] = useState(defaultStartISO);

  const canSubmit =
    title.trim().length > 2 &&
    sport.trim().length > 0 &&
    Number.isFinite(durationMin) &&
    Number.isFinite(capacity);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setError(null);
    try {
      const payload: CreatePayload = {
        kind,
        access,
        admission,
        title: title.trim(),
        sport: sport.trim(),
        startsAt,
        durationMin: Number(durationMin),
        capacity: Number(capacity),
        waitlistEnabled: Boolean(waitlistEnabled),
        locationLat: lat,
        locationLon: lon,
        description: description.trim() || null,
      };
      await http.post("/api/v1/event", payload);
      onCreated?.();
    } catch (err: any) {
      setError(err?.message || "Не удалось создать. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-[61] w-[780px] max-w-[95vw] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {kind === "TRAINING" ? "Создать тренировку" : "Создать событие"}
          </h2>
          <button className="rounded-md px-2 py-1 text-sm hover:bg-gray-100" onClick={onClose}>✕</button>
        </div>

        <form className="grid grid-cols-2 gap-3" onSubmit={submit}>
          <div className="col-span-2">
            <label className="mb-1 block text-sm">Название</label>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Например, Утренняя пробежка" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div>
            <label className="mb-1 block text-sm">Доступ</label>
            <select className="w-full rounded-md border px-3 py-2" value={access} onChange={(e) => setAccess(e.target.value as any)}>
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
              <option value="CLUB_ONLY">CLUB_ONLY</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Приём заявок</label>
            <select className="w-full rounded-md border px-3 py-2" value={admission} onChange={(e) => setAdmission(e.target.value as any)}>
              <option value="AUTO">AUTO</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Вид спорта</label>
            <input className="w-full rounded-md border px-3 py-2" placeholder="Например, RUNNING" value={sport} onChange={(e) => setSport(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm">Начало (ISO)</label>
            <input className="w-full rounded-md border px-3 py-2" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm">Длительность, мин</label>
            <input type="number" min={5} className="w-full rounded-md border px-3 py-2" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
          </div>

          <div>
            <label className="mb-1 block text-sm">Вместимость</label>
            <input type="number" min={1} className="w-full rounded-md border px-3 py-2" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>

          <div className="col-span-2 flex gap-3 items-center">
            <input id="wl" type="checkbox" className="h-4 w-4" checked={waitlistEnabled} onChange={(e) => setWaitlistEnabled(e.target.checked)} />
            <label htmlFor="wl" className="text-sm select-none">Лист ожидания</label>
          </div>

          <div>
            <label className="mb-1 block text-sm">Широта (lat)</label>
            <input className="w-full rounded-md border px-3 py-2 bg-gray-50" value={lat} readOnly />
          </div>
          <div>
            <label className="mb-1 block text-sm">Долгота (lon)</label>
            <input className="w-full rounded-md border px-3 py-2 bg-gray-50" value={lon} readOnly />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-sm">Описание</label>
            <textarea className="w-full min-h-[90px] rounded-md border px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && <div className="col-span-2 text-sm text-red-600">{error}</div>}

          <div className="col-span-2 mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm hover:bg-gray-100" disabled={busy}>Отмена</button>
            <button type="submit" disabled={!canSubmit || busy} className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white shadow hover:bg-emerald-700 disabled:opacity-60">
              {busy ? "Создаю..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
