import React, { useMemo, useState } from "react";
import type { Event } from "@/entities/event/types";
import { SPORTS_FALLBACK, normalizeSportCode } from "@/shared/lib/sport";

export type EventFormValues = {
  title: string;
  sport: string;
  startsAtISO: string;      // ISO 8601
  durationMin: number;
  capacity?: number | null;
  waitlistEnabled: boolean;
  admission: "AUTO" | "MANUAL";
  access: "PUBLIC" | "PRIVATE";
  description?: string | null;
};

function isoToLocalDT(iso: string) {
  // Для input[type=datetime-local] нужен "YYYY-MM-DDTHH:mm"
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function localDTToISO(local: string) {
  // local — без часового пояса → интерпретируем как локальное и превращаем в ISO
  const d = new Date(local);
  return d.toISOString();
}

export default function EventForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial: Event;
  submitting?: boolean;
  onSubmit: (vals: EventFormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const initVals: EventFormValues = useMemo(() => ({
    title: initial.title || "",
    sport: normalizeSportCode(initial.sport || ""),
    startsAtISO: initial.startsAt,
    durationMin: initial.durationMin || 60,
    capacity: initial.capacity ?? null,
    waitlistEnabled: Boolean(initial.waitlistEnabled),
    admission: (initial.admission as any) || "MANUAL",
    access: ((String(initial.access || "PUBLIC").toUpperCase() === "PUBLIC") ? "PUBLIC" : "PRIVATE") as any,
    description: initial.description ?? "",
  }), [initial]);

  const [vals, setVals] = useState<EventFormValues>(initVals);

  const onChange = (k: keyof EventFormValues, v: any) =>
    setVals(s => ({ ...s, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(vals);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm">
          <div className="text-gray-600 mb-1">Название</div>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={vals.title}
            onChange={(e) => onChange("title", e.target.value)}
            required
          />
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Вид спорта</div>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={vals.sport}
            onChange={(e) => onChange("sport", e.target.value)}
            required
          >
            {SPORTS_FALLBACK.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Начало</div>
          <input
            type="datetime-local"
            className="w-full rounded-md border px-3 py-2"
            value={isoToLocalDT(vals.startsAtISO)}
            onChange={(e) => onChange("startsAtISO", localDTToISO(e.target.value))}
            required
          />
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Длительность (мин)</div>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border px-3 py-2"
            value={vals.durationMin}
            onChange={(e) => onChange("durationMin", Number(e.target.value))}
            required
          />
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Вместимость</div>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border px-3 py-2"
            value={vals.capacity ?? ""}
            onChange={(e) => onChange("capacity", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="например, 20"
          />
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Лист ожидания</div>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={vals.waitlistEnabled ? "1" : "0"}
            onChange={(e) => onChange("waitlistEnabled", e.target.value === "1")}
          >
            <option value="0">выкл</option>
            <option value="1">вкл</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Admission</div>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={vals.admission}
            onChange={(e) => onChange("admission", e.target.value as any)}
          >
            <option value="MANUAL">MANUAL</option>
            <option value="AUTO">AUTO</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Access</div>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={vals.access}
            onChange={(e) => onChange("access", e.target.value as any)}
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </label>
      </div>

      <label className="text-sm block">
        <div className="text-gray-600 mb-1">Описание</div>
        <textarea
          className="w-full rounded-md border px-3 py-2 min-h-[100px]"
          value={vals.description ?? ""}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="О программе, инвентаре, месте встречи…"
        />
      </label>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md px-4 py-2 bg-black text-white text-sm disabled:opacity-50"
        >
          {submitting ? "Сохранение…" : "Сохранить"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 border text-sm"
          >
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
