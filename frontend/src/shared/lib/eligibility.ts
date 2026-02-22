import type { Event } from "@/entities/event/types";
import type { UserSkill } from "@/features/skills/api";
import { normalizeSportCode, sportLabel } from "@/shared/lib/sport";
import { levelRangeText } from "@/shared/lib/level";

export function checkLevelEligibility(ev: Event, mySkills: UserSkill[] | null | undefined): {
  ok: boolean;
  message?: string;
} {
  const min = ev.levelMin == null ? 1 : Number(ev.levelMin);
  const max = ev.levelMax == null ? 5 : Number(ev.levelMax);
  const code = normalizeSportCode(ev.sport);
  const kind = String(ev.kind || "EVENT").toUpperCase();
  const kindRu = kind === "TRAINING" ? "тренировки" : "события";

  const skills = mySkills || [];
  const sk = skills.find((s) => normalizeSportCode(s.sport) === code);
  const my = sk ? Number(sk.level) : NaN;

  if (!Number.isFinite(my) || my <= 0) {
    const sport = sportLabel(ev.sport) || ev.sport;
    return {
      ok: false,
      message: `У вас не указан уровень для вида спорта «${sport}». Добавьте навык в профиле, чтобы записываться на ${kindRu}.`,
    };
  }

  if (Number.isFinite(min) && my < min) {
    return {
      ok: false,
      message: `Ваш уровень (${my}) не соответствует требованию события (${levelRangeText(min, max)}).`,
    };
  }
  if (Number.isFinite(max) && my > max) {
    return {
      ok: false,
      message: `Ваш уровень (${my}) не соответствует требованию события (${levelRangeText(min, max)}).`,
    };
  }

  return { ok: true };
}
