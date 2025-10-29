import React, { useMemo, useState } from "react";
import { http } from "@/api/http";
import type { LngLat } from "../../lib/geo";

type Props = {
  open: boolean;
  kind: "EVENT" | "TRAINING";
  coords: LngLat;                // [lon, lat] — фиксируются из ПКМ
  onClose: () => void;
  onCreated?: () => void;        // колбэк после успешного создания
};

type Access = "PUBLIC" | "PRIVATE" | "CLUB_ONLY";
type Admission = "AUTO" | "MANUAL";

/** Русские лейблы → англ. коды для API */
const SPORTS = [
  { value: "RUNNING",    label: "Бег" },
  { value: "FOOTBALL",   label: "Футбол" },
  { value: "BASKETBALL", label: "Баскетбол" },
  { value: "TENNIS",     label: "Теннис" },
  { value: "CYCLING",    label: "Велоспорт" },
  { value: "SWIMMING",   label: "Плавание" },
  { value: "GYM",        label: "Зал/Фитнес" },
  { value: "YOGA",       label: "Йога" },
  { value: "WALKING",    label: "Ходьба" },
] as const;
type Sport = typeof SPORTS[number]["value"];

type CreatePayload = {
  kind: "EVENT" | "TRAINING";
  access: Access;
  admission: Admission;
  title: string;
  sport: string;          // код (англ.)
  startsAt: string;       // ISO-8601
  durationMin: number;
  capacity: number;       // кол-во слотов
  waitlistEnabled: boolean;
  locationLat: number;
  locationLon: number;
  description?: string | null;
};

// формат для <input type="datetime-local">
function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export const CreateEventModal: React.FC<Props> = ({ open, kind, coords, onClose, onCreated }) => {
  if (!open) return null;

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState<Sport>("RUNNING");        // храним код
  const [access, setAccess] = useState<Access>("PUBLIC");
  const [admission, setAdmission] = useState<Admission>("AUTO");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [slots, setSlots] = useState<number>(2); // минимум 2
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // фиксированные координаты из ПКМ
  const [lon, lat] = coords;

  // старт по умолчанию — ближайшие 15 минут, локальное время
  const defaultLocalStart = useMemo(() => {
    const dt = new Date();
    const minutes = dt.getMinutes();
    const rounded = Math.ceil((minutes + 1) / 15) * 15; // ближайшая четверть часа
    dt.setMinutes(rounded, 0, 0);
    return toDatetimeLocalValue(dt);
  }, []);
  const [startsLocal, setStartsLocal] = useState(defaultLocalStart);

  const canSubmit =
    title.trim().length > 2 &&
    sport.trim().length > 0 &&
    Number.isFinite(durationMin) &&
    durationMin >= 5 &&
    Number.isFinite(slots) &&
    slots >= 2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setError(null);
    try {
      // конвертируем локальное значение в ISO (UTC) для бэка
      const startsAtISO = new Date(startsLocal).toISOString();

      console.info("[CreateEventModal] submit → coords to backend", {
        kind,
        locationLat: lat,
        locationLon: lon,
        startsAtISO,
      });
      
      const payload: CreatePayload = {
        kind,
        access,
        admission,
        title: title.trim(),
        sport, // код для API
        startsAt: startsAtISO,
        durationMin: Number(durationMin),
        capacity: Number(slots),
        waitlistEnabled: true, // ← всегда включено
        locationLat: lat,
        locationLon: lon,
        description: description.trim() || null,
      };

      // важно: без удвоения /api/v1 (если baseURL="/api/v1")
      await http.post("/event", payload);

      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Не удалось создать. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative z-[61] w-[780px] max-w-[95vw] rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {kind === "TRAINING" ? "Создать тренировку" : "Создать событие"}
          </h2>
          <button className="rounded-md px-2 py-1 text-sm hover:bg-gray-100" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="grid grid-cols-2 gap-3" onSubmit={submit}>
          <div className="col-span-2">
            <label className="mb-1 block text-sm">Название</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              placeholder="Например, Утренняя пробежка"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Доступ</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={access}
              onChange={(e) => setAccess(e.target.value as Access)}
            >
              <option value="PUBLIC">Публичный</option>
              <option value="PRIVATE">По приглашению</option>
              <option value="CLUB_ONLY">Только для клуба</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Приём заявок</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={admission}
              onChange={(e) => setAdmission(e.target.value as Admission)}
            >
              <option value="AUTO">Автоматически</option>
              <option value="MANUAL">Вручную</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Вид спорта</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
            >
              {SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Начало</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border px-3 py-2"
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Длительность, мин</label>
            <input
              type="number"
              min={5}
              className="w-full rounded-md border px-3 py-2"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Слотов</label>
            <input
              type="number"
              min={2}
              className="w-full rounded-md border px-3 py-2"
              value={slots}
              onChange={(e) => setSlots(Number(e.target.value))}
            />
          </div>

          {/* Lat/Lon скрыты — берём из coords */}

          <div className="col-span-2">
            <label className="mb-1 block text-sm">Описание</label>
            <textarea
              className="w-full min-h-[90px] rounded-md border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <div className="col-span-2 text-sm text-red-600">{error}</div>}

          <div className="col-span-2 mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm hover:bg-gray-100"
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white shadow hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? "Создаю..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
