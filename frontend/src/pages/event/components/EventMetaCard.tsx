import type { Event } from "@/entities/event/types";
import { levelLabel, levelRangeText } from "@/shared/lib/level";

function fmtNoSeconds(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function accessRu(v?: string) {
  return String(v || "PUBLIC").toUpperCase() === "PRIVATE" ? "По приглашению" : "Публичный";
}
function admissionRu(v?: string) {
  return String(v || "AUTO").toUpperCase() === "MANUAL" ? "Ручной" : "Автоматически";
}

export default function EventMetaCard({ ev }: { ev: Event }) {
  const min = ev.levelMin == null ? 1 : Number(ev.levelMin);
  const max = ev.levelMax == null ? 5 : Number(ev.levelMax);
  const levelText = min === max
    ? `${levelLabel(min)} (${min})`
    : `${levelLabel(min)} – ${levelLabel(max)} (${levelRangeText(min, max)})`;

  const createdAt = (ev as any).createdAt as string | undefined;

  return (
    <div className="rounded-xl border p-4">
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        <div>
          <span className="text-gray-500">Начало:</span>
          <br />
          {fmtNoSeconds(ev.startsAt)}
        </div>
        <div>
          <span className="text-gray-500">Длительность:</span>
          <br />
          {ev.durationMin} мин
        </div>
        <div>
          <span className="text-gray-500">Количество участников:</span>
          <br />
          {(ev as any).capacity ?? "—"}
        </div>
        <div>
          <span className="text-gray-500">Уровень участников:</span>
          <br />
          {levelText}
        </div>

        <div>
          <span className="text-gray-500">Доступ:</span>
          <br />
          {accessRu((ev as any).access)}
        </div>
        <div>
          <span className="text-gray-500">Приём заявок:</span>
          <br />
          {admissionRu((ev as any).admission)}
        </div>

        {createdAt ? (
          <div>
            <span className="text-gray-500">Создано:</span>
            <br />
            {fmtNoSeconds(createdAt)}
          </div>
        ) : null}
      </div>

      {(ev as any).launchedAt && (
        <div className="mt-3 text-sm">
          <span className="text-gray-500">Запуск:</span>{" "}
          {fmtNoSeconds((ev as any).launchedAt)}
        </div>
      )}

      {ev.description && (
        <div className="mt-4">
          <div className="mb-1 text-sm text-gray-500">Описание</div>
          <div className="whitespace-pre-wrap">{ev.description}</div>
        </div>
      )}
    </div>
  );
}
