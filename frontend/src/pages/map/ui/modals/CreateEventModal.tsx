import React, { useEffect, useMemo, useState } from "react";
import { http } from "@/api/http";
import { listSports } from "@/entities/sport/api";
import { normalizeSportCode } from "@/shared/lib/sport";
import type { LngLat } from "../../lib/geo";

type Props = {
  open: boolean;
  kind: "EVENT" | "TRAINING";
  coords: LngLat;                // [lon, lat] — фиксируются из ПКМ
  onClose: () => void;
  onCreated?: (created?: any) => void; // колбэк после успешного создания
};

type Access = "PUBLIC" | "PRIVATE";
type Admission = "AUTO" | "MANUAL";

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
  const [sports, setSports] = useState<{code:string;name:string}[]>([]);
  const [sport, setSport] = useState<string>("RUNNING");
  const [access, setAccess] = useState<Access>("PUBLIC");
  const [admission, setAdmission] = useState<Admission>("AUTO");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [slots, setSlots] = useState<number>(2); // минимум 2
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // фиксированные координаты из ПКМ
  const [lon, lat] = coords;

  // если это TRAINING — принудительно MANUAL
  useEffect(() => {
    if (kind === "TRAINING") setAdmission("MANUAL");
  }, [kind]);

  useEffect(() => {
    listSports()
      .then((arr) => {
        setSports(arr ?? []);
        if ((arr ?? []).length && !sport) setSport(arr[0].code);
      })
      .catch(() => setSports([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // старт по умолчанию — ближайшие 15 минут, локальное время
  const defaultLocalStart = useMemo(() => {
    const dt = new Date();
    const minutes = dt.getMinutes();
    const rounded = Math.ceil((minutes + 1) / 15) * 15;
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
      const startsAtISO = new Date(startsLocal).toISOString();

      const admissionForBackend: Admission =
        kind === "TRAINING" ? "MANUAL" : admission;

      console.info("[CreateEventModal] submit → coords to backend", {
        kind,
        locationLat: lat,
        locationLon: lon,
        startsAtISO,
        admission: admissionForBackend,
      });

      const payload: CreatePayload = {
        kind,
        access,
        admission: admissionForBackend,
        title: title.trim(),
        sport: normalizeSportCode(sport),
        startsAt: startsAtISO,
        durationMin: Number(durationMin),
        capacity: Number(slots),
        waitlistEnabled: true, // лист ожидания всегда включён
        locationLat: lat,
        locationLon: lon,
        description: description.trim() || null,
      };

        const { data } = await http.post("/event", payload); // backend отдает EventResponse
        onCreated?.(data); // пробрасываем созданный объект наверх

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
                          </select>
          </div>

          <div>
            <label className="mb-1 block text-sm">Приём заявок</label>
            <select
              className="w-full rounded-md border px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
              value={admission}
              onChange={(e) => setAdmission(e.target.value as Admission)}
              disabled={kind === "TRAINING"} // фиксируем MANUAL
              title={kind === "TRAINING" ? "Для тренировок приём только вручную" : ""}
            >
              <option value="AUTO">Автоматически</option>
              <option value="MANUAL">Вручную</option>
            </select>
            {kind === "TRAINING" && (
              <p className="mt-1 text-xs text-gray-500">
                Для тренировок приём заявок всегда «Вручную» (требование сервера).
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm">Вид спорта</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              {(sports && sports.length ? sports : []).map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
              {/* fallback: если /sport не доступен */}
              {!sports?.length && (
                <>
                  <option value="RUNNING">Бег</option>
                  <option value="FOOTBALL">Футбол</option>
                  <option value="BASKETBALL">Баскетбол</option>
                  <option value="VOLLEYBALL">Волейбол</option>
                  <option value="TENNIS">Теннис</option>
                  <option value="SWIMMING">Плавание</option>
                  <option value="CYCLING">Велоспорт</option>
                  <option value="YOGA">Йога</option>
                  <option value="BOXING">Бокс</option>
                  <option value="MMA">MMA</option>
                </>
              )}
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
