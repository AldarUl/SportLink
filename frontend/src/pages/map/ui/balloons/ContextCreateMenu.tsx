import React from "react";

type Props = {
  lat: number;
  lon: number;
  onCreate(kind: "EVENT" | "TRAINING"): void;
  onClose(): void;
};

export default function ContextCreateMenu({ lat, lon, onCreate, onClose }: Props) {
  return (
    <div
      className="relative"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* «хвостик» (стрелка на точку) */}
      <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white drop-shadow" />

      <div className="rounded-xl bg-white px-3 py-2 shadow-lg border text-sm">
        <div className="mb-2 text-xs text-gray-500">
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
            onClick={() => onCreate("TRAINING")}
          >
            Создать тренировку
          </button>
          <button
            className="rounded-md bg-sky-600 px-3 py-1 text-white hover:bg-sky-700"
            onClick={() => onCreate("EVENT")}
          >
            Создать событие
          </button>
        </div>
        <button
          className="mt-2 block w-full rounded-md border px-2 py-1 text-gray-600 hover:bg-gray-50"
          onClick={onClose}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
