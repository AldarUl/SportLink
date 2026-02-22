import React from "react";
import { useToastStore } from "./toast";

export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);

  if (!items.length) return null;

  const clsByType = (t: string) => {
    if (t === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
    if (t === "error") return "border-red-200 bg-red-50 text-red-900";
    return "border-slate-200 bg-white text-slate-900";
  };

  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-[340px] max-w-[92vw] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl border px-3 py-2 shadow-lg ${clsByType(t.type)}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-sm leading-snug break-words">{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="-mr-1 -mt-1 rounded px-2 py-1 text-xs opacity-70 hover:opacity-100"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
