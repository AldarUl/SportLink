import { useCallback, useRef, useState } from "react";
import { kmBetween, type LngLat } from "../lib/geo";

export function useViewport() {
  const [zoom, setZoom] = useState<number>(12);
  const [viewportDiagKm, setViewportDiagKm] = useState<number>(Infinity);
  const zoomRef = useRef(zoom);

  const onMapUpdate = useCallback((loc: any) => {
    if (loc?.zoom != null) {
      setZoom(loc.zoom);
      zoomRef.current = loc.zoom;
    }
    if (Array.isArray(loc?.bounds)) {
      const [[minLng, minLat], [maxLng, maxLat]] = loc.bounds as [[number, number],[number, number]];
      const diag = kmBetween([minLng, minLat] as LngLat, [maxLng, maxLat] as LngLat);
      setViewportDiagKm(diag);
    }
  }, []);

  return { zoom, viewportDiagKm, zoomRef, onMapUpdate, setViewportDiagKm, setZoom };
}
