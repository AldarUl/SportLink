import React from "react";

export function DragDock({
  onDragStart,
  onRecenter,
}: {
  onDragStart: (e: React.DragEvent, kind: "EVENT" | "TRAINING") => void;
  onRecenter: () => void;
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
    <div className="flex w-[96px] flex-col items-center">
      <button
        draggable
        onDragStart={onDragStart}
        className={`h-14 w-14 rounded-full ${bg} text-white shadow-md transition active:scale-95`}
        title={sub}
      >
        {label}
      </button>
      <div className="mt-1 text-center text-[11px] text-gray-700">{sub}</div>
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
    <div className="flex w-[96px] flex-col items-center">
      <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="group flex h-14 w-14 items-center justify-center rounded-full border bg-white shadow-md transition hover:bg-gray-50 active:scale-95"
      >
        {children}
      </button>
      <div className="mt-1 text-center text-[11px] text-gray-700">{title}</div>
    </div>
  );

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-2xl border bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="flex items-end gap-4">
        <CircleBtn
          label="E"
          sub="Создать событие (drag)"
          bg="bg-amber-500"
          onDragStart={(e: any) => onDragStart(e, "EVENT")}
        />
        <CircleBtn
          label="T"
          sub="Создать тренировку (drag)"
          bg="bg-blue-600"
          onDragStart={(e: any) => onDragStart(e, "TRAINING")}
        />

        <div className="ml-2 h-10 w-px bg-gray-200" />

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
    </div>
  );
}
