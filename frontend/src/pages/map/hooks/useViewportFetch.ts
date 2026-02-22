import { useCallback, useRef } from "react";
import { fetchEventsByBbox } from "@/entities/event/api";
import { useEventStore } from "@/entities/event/store";
import type { Bbox } from "@/entities/event/types";

type YBounds = [[number, number], [number, number]]; // [ [lon1, lat1], [lon2, lat2] ]

function toBbox(bounds: YBounds): Bbox {
  const [[lon1, lat1], [lon2, lat2]] = bounds;

  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);

  return {
    // юго-запад и северо-восток после нормализации
    swLat: minLat,
    swLon: minLon,
    neLat: maxLat,
    neLon: maxLon,
    centerLat: (lat1 + lat2) / 2,
    centerLon: (lon1 + lon2) / 2,
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
  // пока не используем эти параметры, но оставляем контракт (для будущих ограничений по зуму/диагонали)
  void zoomRef;
  void getDiagKm;
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
      } catch (err) {
        console.error("[useViewportFetch] fetch failed:", err); // <-- лог
      }
    }, 220);

  }, [cancel, setEvents]);

  return { handleBounds, cancel };
}
