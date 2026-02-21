import React, { useEffect, useMemo, useState } from "react";
import { http } from "@/api/http";
import { listSports } from "@/entities/sport/api";
import { listMySkills } from "@/features/skills/api";
import { normalizeSportCode, sportLabel } from "@/shared/lib/sport";
import type { LngLat } from "../../lib/geo";

type Props = {
  open: boolean;
  kind: "EVENT" | "TRAINING";
  coords: LngLat; // [lon, lat]
  onClose: () => void;
  onCreated?: (created?: any) => void;
};

type Access = "PUBLIC" | "PRIVATE";
type Admission = "AUTO" | "MANUAL";

type CreatePayload = {
  kind: "EVENT" | "TRAINING";
  access: Access;
  admission: Admission;
  title: string;
  sport: string;
  startsAt: string;
  durationMin: number;
  capacity: number; // ОБЩЕЕ число мест, включая организатора
  waitlistEnabled: boolean;
  locationLat: number;
  locationLon: number;
  description?: string | null;
  levelMin?: number | null;
  levelMax?: number | null;
};

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

  const [sports, setSports] = useState<{ code: string; name: string }[]>([]);
  const [mySportCodes, setMySportCodes] = useState<string[]>([]);

  const [sport, setSport] = useState<string>("RUNNING");
  const [access, setAccess] = useState<Access>("PUBLIC");
  const [admission, setAdmission] = useState<Admission>("AUTO");
  const [durationMin, setDurationMin] = useState<number>(60);

  // IMPORTANT: пользователь вводит количество СВОБОДНЫХ мест (без организатора).
  // На бэке capacity — ОБЩЕЕ число мест, включая организатора.
  const [freeSlots, setFreeSlots] = useState<number>(2);

  // уровень участников (диапазон)
  const [levelFrom, setLevelFrom] = useState<number | "">("");
  const [levelTo, setLevelTo] = useState<number | "">("");

  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lon, lat] = coords;

  // если это TRAINING — принудительно MANUAL
  useEffect(() => {
    if (kind === "TRAINING") setAdmission("MANUAL");
  }, [kind]);

  // грузим справочник спорта + мои навыки
  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        const [sportsArr, skillsArr] = await Promise.all([
          listSports().catch(() => [] as any[]),
          listMySkills().catch(() => [] as any[]),
        ]);

        if (dead) return;
        setSports((sportsArr as any[]) ?? []);

        const codes = (skillsArr as any[])
          .map((x) => normalizeSportCode(x?.sport))
          .filter(Boolean);
        setMySportCodes(Array.from(new Set(codes)));
      } catch {
        if (!dead) {
          setSports([]);
          setMySportCodes([]);
        }
      }
    })();

    return () => {
      dead = true;
    };
  }, []);

  const sportsForSelect = useMemo(() => {
    const base = (sports && sports.length ? sports : []).map((s) => ({
      code: normalizeSportCode(s.code),
      name: s.name || sportLabel(s.code),
    }));

    if (kind !== "TRAINING") return base;

    // TRAINING — только виды спорта, выбранные пользователем в профиле
    const allowed = new Set(mySportCodes.map((c) => normalizeSportCode(c)));
    const filtered = base.filter((s) => allowed.has(normalizeSportCode(s.code)));

    // если /sport не отдал список, всё равно показываем мои навыки
    if (!filtered.length && mySportCodes.length) {
      return mySportCodes.map((code) => ({ code, name: sportLabel(code) }));
    }

    return filtered;
  }, [sports, mySportCodes, kind]);

  // держим выбранный sport валидным
  useEffect(() => {
    if (!sportsForSelect.length) {
      setSport("");
      return;
    }
    const normalized = normalizeSportCode(sport);
    const ok = sportsForSelect.some((s) => normalizeSportCode(s.code) === normalized);
    if (!ok) setSport(sportsForSelect[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportsForSelect.length, kind]);

  const defaultLocalStart = useMemo(() => {
    const dt = new Date();
    const minutes = dt.getMinutes();
    const rounded = Math.ceil((minutes + 1) / 15) * 15;
    dt.setMinutes(rounded, 0, 0);
    return toDatetimeLocalValue(dt);
  }, []);
  const [startsLocal, setStartsLocal] = useState(defaultLocalStart);

  const levelError = useMemo(() => {
    if (levelFrom === "" && levelTo === "") return null;
    const from = levelFrom === "" ? 1 : Number(levelFrom);
    const to = levelTo === "" ? 5 : Number(levelTo);
    if (from > to) return "Неверный диапазон уровня: 'от' больше чем 'до'";
    return null;
  }, [levelFrom, levelTo]);

  const canSubmit =
    title.trim().length > 2 &&
    sport.trim().length > 0 &&
    Number.isFinite(durationMin) &&
    durationMin >= 10 &&
    Number.isFinite(freeSlots) &&
    freeSlots >= 1 &&
    !levelError &&
    // для тренировок обязательно должен быть хотя бы 1 выбранный спорт в профиле
    (kind !== "TRAINING" || sportsForSelect.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setError(null);

    try {
      const startsAtISO = new Date(startsLocal).toISOString();
      const admissionForBackend: Admission = kind === "TRAINING" ? "MANUAL" : admission;

      let lvlMin: number | null = null;
      let lvlMax: number | null = null;
      if (levelFrom !== "" || levelTo !== "") {
        // backend требует либо оба значения, либо оба null.
        const from = levelFrom === "" ? 1 : Number(levelFrom);
        const to = levelTo === "" ? 5 : Number(levelTo);
        if (from > to) throw new Error("Неверный диапазон уровня");
        lvlMin = from;
        lvlMax = to;
      }

      const payload: CreatePayload = {
        kind,
        access,
        admission: admissionForBackend,
        title: title.trim(),
        sport: normalizeSportCode(sport),
        startsAt: startsAtISO,
        durationMin: Number(durationMin),
        // freeSlots -> capacity(total) = free + 1(organizer)
        capacity: Number(freeSlots) + 1,
        waitlistEnabled: true,
        locationLat: lat,
        locationLon: lon,
        description: description.trim() || null,
        levelMin: lvlMin,
        levelMax: lvlMax,
      };

      const { data } = await http.post("/event", payload);
      onCreated?.(data);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Не удалось создать. Попробуйте ещё раз.");
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
        className="relative z-[61] w-[820px] max-w-[95vw] rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{kind === "TRAINING" ? "Создать тренировку" : "Создать событие"}</h2>
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
            <select className="w-full rounded-md border px-3 py-2" value={access} onChange={(e) => setAccess(e.target.value as Access)}>
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
              disabled={kind === "TRAINING"}
              title={kind === "TRAINING" ? "Для тренировок приём только вручную" : ""}
            >
              <option value="AUTO">Автоматически</option>
              <option value="MANUAL">Вручную</option>
            </select>
            {kind === "TRAINING" && (
              <p className="mt-1 text-xs text-gray-500">Для тренировок приём заявок всегда «Вручную».</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm">Вид спорта</label>
            <select
              className="w-full rounded-md border px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              disabled={kind === "TRAINING" && sportsForSelect.length === 0}
            >
              {sportsForSelect.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {kind === "TRAINING" && sportsForSelect.length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                Чтобы создать тренировку, сначала выберите виды спорта и уровни в профиле.
              </p>
            )}
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
              min={10}
              className="w-full rounded-md border px-3 py-2"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Свободных мест (без организатора)</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border px-3 py-2"
              value={freeSlots}
              onChange={(e) => setFreeSlots(Number(e.target.value))}
            />
            <div className="mt-1 text-xs text-gray-500">Всего мест с организатором: {Number.isFinite(freeSlots) ? freeSlots + 1 : "—"}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm">Уровень участников (опционально)</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-md border px-3 py-2"
                value={String(levelFrom)}
                onChange={(e) => {
                  const v = e.target.value;
                  setLevelFrom(v ? Number(v) : "");
                }}
                title="Уровень от"
              >
                <option value="">От (без границ)</option>
                <option value="1">Новичок</option>
                <option value="2">Любитель</option>
                <option value="3">Уверенный</option>
                <option value="4">Продвинутый</option>
                <option value="5">Профи</option>
              </select>

              <select
                className="w-full rounded-md border px-3 py-2"
                value={String(levelTo)}
                onChange={(e) => {
                  const v = e.target.value;
                  setLevelTo(v ? Number(v) : "");
                }}
                title="Уровень до"
              >
                <option value="">До (без границ)</option>
                <option value="1">Новичок</option>
                <option value="2">Любитель</option>
                <option value="3">Уверенный</option>
                <option value="4">Продвинутый</option>
                <option value="5">Профи</option>
              </select>
            </div>

            <div className="mt-1 text-xs text-gray-500">
              Можно оставить пустым. Если заполнена только одна граница, вторая автоматически станет 1 или 5.
            </div>

            {levelError && <div className="mt-1 text-xs text-red-600">{levelError}</div>}
          </div>

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
