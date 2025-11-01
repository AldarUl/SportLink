import React, { useMemo, useState } from "react";
import type { Event as AppEvent } from "@/entities/event/types";
import { useApplicationStore } from "@/entities/application/store";

export default function ApplyWithdrawButton({
  event,
  size = "md",
  onAfterChange,
}: {
  event: AppEvent;
  size?: "sm" | "md";
  onAfterChange?: () => void;
}) {
  const { findByEventId, apply, withdrawByEvent } = useApplicationStore();
  const [busy, setBusy] = useState<"apply" | "withdraw" | null>(null);

  // текущее состояние заявки по событию
    const app = useApplicationStore((s) => s.findByEventId(event.id));
console.debug("ApplyBtn", {
  eventId: event.id,
  app,
  mineLen: useApplicationStore.getState().mine.length
});

    const ACTIVE_STATUSES = new Set(["PENDING", "CONFIRMED", "WAITLISTED"]);
    const isActive = !!app && ACTIVE_STATUSES.has(app.status);
    const isWaitlisted = app?.status === "WAITLISTED";


  const pad = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-[6px] text-sm";

  async function doApply() {
    try {
      setBusy("apply");
      await apply(event);
      onAfterChange?.();
    } finally {
      setBusy(null);
    }
  }

  async function doWithdraw() {
    try {
      setBusy("withdraw");
      await withdrawByEvent(event.id);
      onAfterChange?.();
    } finally {
      setBusy(null);
    }
  }

  // ВАЖНО: только наши css-классы .sl-btn + модификаторы,
  // никаких bg-/text- утилит, чтобы не перезатирали анимации
    if (!isActive) {
    return (
        <button
        type="button"
        className={`sl-btn sl-btn--cta ${pad} ${busy ? "opacity-80" : ""}`}
        onClick={doApply}
        disabled={busy !== null}
        aria-busy={busy === "apply"}
        >
        {busy === "apply" ? "Запись…" : "Записаться"}
        </button>
    );
    }

    return (
    <button
        type="button"
        className={`sl-btn sl-btn--danger ${pad} ${busy ? "opacity-80" : ""}`}
        onClick={doWithdraw}
        disabled={busy !== null}
        aria-busy={busy === "withdraw"}
        title={isWaitlisted ? "Вы в листе ожидания" : undefined}
    >
        {busy === "withdraw" ? "Отзыв…" : (isWaitlisted ? "Отозвать (лист ожидания)" : "Отозвать")}
    </button>
    );
}
