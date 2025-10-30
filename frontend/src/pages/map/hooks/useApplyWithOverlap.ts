import { useApplicationStore } from "@/entities/application/store";
import { willOverlapWithAny } from "@/shared/schedule";
import type { Event as AppEvent } from "@/entities/event/types";

export function useApplyWithOverlap() {
  const { mine, apply: applyAction, withdrawByEvent, findByEventId, loadMine } = useApplicationStore();

  const handleApply = async (ev: AppEvent) => {
    try {
      const active = mine
        .filter(a => a.event && (a.status === "CONFIRMED" || a.status === "PENDING"))
        .map(a => ({ start: a.event!.startsAt, durMin: a.event!.durationMin }));
      const want = { start: ev.startsAt, durMin: ev.durationMin };

      if (willOverlapWithAny(want, active)) {
        alert("Нельзя записаться: пересечение по времени с уже активной тренировкой.");
        return;
      }
      await applyAction(ev);
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || "Не удалось подать заявку");
    }
  };

  return { mine, loadMine, handleApply, withdrawByEvent, findByEventId };
}
