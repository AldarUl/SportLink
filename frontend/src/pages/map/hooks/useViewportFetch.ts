import { useCallback, useRef } from "react";
import { fetchEventsByBbox } from "@/entities/event/api";
import { useEventStore } from "@/entities/event/store";
import type { Bbox } from "@/entities/event/types";

type YBounds = [[number, number], [number, number]]; // [[minLon,minLat],[maxLon,maxLat]]

function toBbox(bounds: YBounds): Bbox {
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  return {
    swLat: minLat,
    swLon: minLon,
    neLat: maxLat,
    neLon: maxLon,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
  };
}

/**
 * Хук дергает бэкенд по BBOX. Делает простой debounce и отменяет устаревшие вызовы.
 * @param zoomRef   — ref с текущим зумом (если нужно ограничивать что-то по зуму)
 * @param getDiagKm — функция, дающая диагональ вьюпорта в км (если нужно ограничивать тренировки)
 */
export function useViewportFetch(
  zoomRef: React.MutableRefObject<number>,
  getDiagKm: () => number
) {
  const setEvents = useEventStore(s => s.setEvents);
  const seqRef = useRef(0);
  const tRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (tRef.current) {
      window.clearTimeout(tRef.current);
      tRef.current = null;
    }
    seqRef.current++;
  }, []);

  const handleBounds = useCallback((bounds: YBounds) => {
    cancel();
    const mySeq = ++seqRef.current;
    tRef.current = window.setTimeout(async () => {
      try {
        const bbox = toBbox(bounds);
        const events = await fetchEventsByBbox(bbox, undefined, 500);
        if (seqRef.current !== mySeq) return;
        setEvents(events);
      } catch {
        // можно добавить toast
      }
    }, 220);
  }, [cancel, setEvents]);

  return { handleBounds, cancel };
}
