// src/pages/EventCreatePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSports } from "@/entities/sport/api";
import { createEvent } from "@/entities/event/api";
import { normalizeSportCode } from "@/shared/lib/sport";
import type { Event } from "@/entities/event/types";
import { useAuthStore } from "@/features/auth/store";

type Form = {
  kind: Event["kind"];
  title: string;
  sport: string;
  description?: string;
  startsAt: string;
  durationMin?: number;
  capacity?: number;
  waitlistEnabled?: boolean;
  access: Event["access"];
  admission: Event["admission"];
  locationLat?: number;
  locationLon?: number;
  registrationDeadline?: string;
};

const KINDS: Event["kind"][] = ["TRAINING", "EVENT"];
const ACCESS: Event["access"][] = ["PUBLIC", "PRIVATE"];
const ADMISSION: Event["admission"][] = ["AUTO", "MANUAL"];

export default function EventCreatePage() {
  const navigate = useNavigate();
  const me = useAuthStore(s => s.user); // предполагаю, что у тебя где-то есть user в сторе
  const organizerId = me?.userId ?? me?.id; // подстрой под свой стор

  const [sports, setSports] = useState<{code:string;name:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<Form>({
    kind: "EVENT",
    title: "",
    sport: "",
    startsAt: new Date(Date.now() + 3600_000).toISOString(), // через час
    durationMin: 60,
    capacity: 10,
    waitlistEnabled: false,
    access: "PUBLIC",
    admission: "AUTO",
    locationLat: undefined,
    locationLon: undefined,
  });

  useEffect(() => {
    listSports().then(setSports).catch(() => setSports([]));
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(
      organizerId &&
      f.kind &&
      f.title.trim().length > 0 &&
      f.sport &&
      f.startsAt &&
      f.access &&
      f.admission
    );
  }, [organizerId, f]);

  const onChange = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF(prev => ({ ...prev, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organizerId) {
      setError("Нужно быть авторизованным для создания события.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        kind: f.kind,
        title: f.title.trim(),
        sport: normalizeSportCode(f.sport),
        startsAt: f.startsAt, // ISO string
        access: f.access,
        admission: f.admission,
        organizerId,
        description: f.description?.trim() || undefined,
        durationMin: f.durationMin,
        capacity: f.capacity,
        waitlistEnabled: f.waitlistEnabled,
        recurrenceRule: undefined,
        registrationDeadline: f.registrationDeadline,
        locationLat: f.locationLat,
        locationLon: f.locationLon,
      };
      const created = await createEvent(payload);
      // после создания — уходим на страницу события или на карту
      navigate(`/event/${created.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Не удалось создать событие");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Создать событие/тренировку</h1>

      {error && <div className="rounded bg-red-50 text-red-700 p-2 text-sm">{error}</div>}

      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Тип</span>
            <select
              className="border rounded p-2"
              value={f.kind}
              onChange={e => onChange("kind", e.target.value as Form["kind"])}
            >
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Доступ</span>
            <select
              className="border rounded p-2"
              value={f.access}
              onChange={e => onChange("access", e.target.value as Form["access"])}
            >
              {ACCESS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Приём заявок</span>
            <select
              className="border rounded p-2"
              value={f.admission}
              onChange={e => onChange("admission", e.target.value as Form["admission"])}
            >
              {ADMISSION.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Название</span>
          <input
            className="border rounded p-2"
            value={f.title}
            onChange={e => onChange("title", e.target.value)}
            placeholder="Например, Утренняя пробежка"
            required
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Вид спорта</span>
            <select
              className="border rounded p-2"
              value={f.sport}
              onChange={e => onChange("sport", e.target.value)}
              required
            >
              <option value="" disabled>Выберите вид спорта</option>
              {sports.map(s => <option key={s.code} value={s.name || s.code}>{s.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Начало (ISO)</span>
            <input
              className="border rounded p-2"
              value={f.startsAt}
              onChange={e => onChange("startsAt", e.target.value)}
              placeholder="2025-10-30T10:00:00Z"
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Длительность, мин</span>
            <input
              type="number"
              className="border rounded p-2"
              value={f.durationMin ?? 60}
              onChange={e => onChange("durationMin", Number(e.target.value))}
              min={10}
              max={1440}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Вместимость</span>
            <input
              type="number"
              className="border rounded p-2"
              value={f.capacity ?? 10}
              onChange={e => onChange("capacity", Number(e.target.value))}
              min={1}
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={Boolean(f.waitlistEnabled)}
              onChange={e => onChange("waitlistEnabled", e.target.checked)}
            />
            <span className="text-sm">Лист ожидания</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Широта (lat)</span>
            <input
              type="number"
              className="border rounded p-2"
              value={f.locationLat ?? ""}
              onChange={e => onChange("locationLat", e.target.value === "" ? undefined : Number(e.target.value))}
              step="0.000001"
              placeholder="55.75"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500">Долгота (lon)</span>
            <input
              type="number"
              className="border rounded p-2"
              value={f.locationLon ?? ""}
              onChange={e => onChange("locationLon", e.target.value === "" ? undefined : Number(e.target.value))}
              step="0.000001"
              placeholder="37.62"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Описание</span>
          <textarea
            className="border rounded p-2"
            value={f.description ?? ""}
            onChange={e => onChange("description", e.target.value)}
            rows={4}
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="rounded px-4 py-2 bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700 active:scale-[0.99]"
          >
            {saving ? "Создаю..." : "Создать"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded px-4 py-2 border hover:bg-gray-50 active:scale-[0.99]"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
