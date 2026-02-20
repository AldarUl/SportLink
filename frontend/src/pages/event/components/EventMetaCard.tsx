import React from "react";
import type { Event } from "@/entities/event/types";

export default function EventMetaCard({ ev }: { ev: Event }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        <div>
          <span className="text-gray-500">Начало:</span>
          <br />
          {new Date(ev.startsAt).toLocaleString()}
        </div>
        <div>
          <span className="text-gray-500">Длительность:</span>
          <br />
          {ev.durationMin} мин
        </div>
        <div>
          <span className="text-gray-500">Вместимость:</span>
          <br />
          {(ev as any).capacity ?? "—"}
        </div>
        <div>
          <span className="text-gray-500">Лист ожидания:</span>
          <br />
          {(ev as any).waitlistEnabled ? "вкл" : "выкл"}
        </div>
      </div>

      {(ev as any).launchedAt && (
        <div className="mt-3 text-sm">
          <span className="text-gray-500">Запуск тренировки:</span>{" "}
          {new Date((ev as any).launchedAt).toLocaleString()}
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
