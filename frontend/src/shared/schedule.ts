import type { Event } from "@/entities/event/types";

export function hasOverlap(a:{start:string; durMin:number}, b:{start:string; durMin:number}) {
  const s1 = new Date(a.start).getTime(), e1 = s1 + a.durMin * 60000;
  const s2 = new Date(b.start).getTime(), e2 = s2 + b.durMin * 60000;
  return s1 < e2 && s2 < e1;
}

export function eventOverlaps(a: Pick<Event,"startsAt"|"durationMin">,
                              b: Pick<Event,"startsAt"|"durationMin">) {
  return hasOverlap({ start: a.startsAt, durMin: a.durationMin },
                    { start: b.startsAt, durMin: b.durationMin });
}

export function willOverlapWithAny(target: Pick<Event,"startsAt"|"durationMin">,
                                   confirmed: Array<Pick<Event,"startsAt"|"durationMin">>) {
  return confirmed.some(e => eventOverlaps(target, e));
}
