import React from "react";
import type { SportItem } from "@/shared/lib/sport";

type LevelVal = number | "";

export function DragDock({
  onDragStart,
  onRecenter,
  sports,
  sportFilter,
  levelFrom,
  levelTo,
  onSportFilterChange,
  onLevelFromChange,
  onLevelToChange,
}: {
  onDragStart: (e: React.DragEvent, kind: "EVENT" | "TRAINING") => void;
  onRecenter: () => void;
  sports: SportItem[];
  sportFilter: string;
  levelFrom: LevelVal;
  levelTo: LevelVal;
  onSportFilterChange: (code: string) => void;
  onLevelFromChange: (lvl: LevelVal) => void;
  onLevelToChange: (lvl: LevelVal) => void;
}) {
  const CircleBtn = ({
    label,
    sub,
    bg,
    onDragStart,
  }: {
    label: string;
    sub: string;
    bg: string;
    onDragStart: any;
  }) => (
    <div className="flex w-[88px] flex-col items-center">
      <button
        draggable
        onDragStart={onDragStart}
        className={`h-14 w-14 rounded-full ${bg} text-white shadow-md transition active:scale-95`}
        title={sub}
      >
        {label}
      </button>
      <div className="mt-1 text-center text-[11px] text-gray-700 leading-tight">{sub}</div>
    </div>
  );

  const CircleIconBtn = ({
    title,
    onClick,
    children,
  }: {
    title: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <div className="flex w-[88px] flex-col items-center">
      <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="group flex h-14 w-14 items-center justify-center rounded-full border bg-white shadow-md transition hover:bg-gray-50 active:scale-95"
      >
        {children}
      </button>
      <div className="mt-1 text-center text-[11px] text-gray-700 leading-tight">{title}</div>
    </div>
  );

  const anyFilterOn = sportFilter || levelFrom !== "" || levelTo !== "";

  return (
    // Было: w-[720px] => из-за этого "белый блок" занимал половину карты
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-[420px] max-w-[94vw] rounded-2xl border bg-white/95 px-2 py-2 shadow-xl backdrop-blur">
      {/* Центрируем весь верхний ряд */}
      <div className="flex items-end justify-center gap-3">
        <CircleBtn
          label="E"
          sub="Событие"
          bg="bg-amber-500"
          onDragStart={(e: any) => onDragStart(e, "EVENT")}
        />
        <CircleBtn
          label="T"
          sub="Тренировка"
          bg="bg-blue-600"
          onDragStart={(e: any) => onDragStart(e, "TRAINING")}
        />

        <div className="mx-1 h-10 w-px bg-gray-200" />

        <CircleIconBtn title="Моё место" onClick={onRecenter}>
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-blue-600 transition-transform group-hover:rotate-12 group-active:scale-90"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l7 19-7-4-7 4 7-19z" />
          </svg>
        </CircleIconBtn>
      </div>

      {/* filters */}
      <div className="mt-2 border-t pt-2">
        <div className="mb-1 text-[11px] font-semibold text-gray-700">Фильтры карты</div>

        <div className="space-y-2">
          <select
            className="w-full rounded-md border px-2 py-2 text-xs"
            value={sportFilter}
            onChange={(e) => onSportFilterChange(e.target.value)}
            title="Фильтр по виду спорта"
          >
            <option value="">Все виды спорта</option>
            {(sports || []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              className="w-full rounded-md border px-2 py-2 text-xs"
              value={String(levelFrom)}
              onChange={(e) => {
                const v = e.target.value;
                onLevelFromChange(v ? Number(v) : "");
              }}
              title="Уровень от"
            >
              <option value="">Уровень от (любой)</option>
              <option value="1">Новичок</option>
              <option value="2">Любитель</option>
              <option value="3">Уверенный</option>
              <option value="4">Продвинутый</option>
              <option value="5">Профи</option>
            </select>

            <select
              className="w-full rounded-md border px-2 py-2 text-xs"
              value={String(levelTo)}
              onChange={(e) => {
                const v = e.target.value;
                onLevelToChange(v ? Number(v) : "");
              }}
              title="Уровень до"
            >
              <option value="">Уровень до (любой)</option>
              <option value="1">Новичок</option>
              <option value="2">Любитель</option>
              <option value="3">Уверенный</option>
              <option value="4">Продвинутый</option>
              <option value="5">Профи</option>
            </select>
          </div>

          {anyFilterOn && (
            <button
              className="w-full rounded-md border px-2 py-2 text-xs hover:bg-gray-50"
              onClick={() => {
                onSportFilterChange("");
                onLevelFromChange("");
                onLevelToChange("");
              }}
              title="Сбросить фильтры"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>
    </div>
  );
}