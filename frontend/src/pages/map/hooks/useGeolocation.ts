import { useEffect, useState } from "react";
import type { LngLat } from "../lib/geo";

export function useGeolocation(apiReady: boolean, initial: LngLat = [37.618423, 55.751244]) {
  const [myPos, setMyPos] = useState<LngLat | null>(null);
  const [geoPending, setGeoPending] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ center: LngLat; zoom: number }>({
    center: initial, zoom: 12,
  });

  useEffect(() => {
    if (!apiReady) return;
    if (!navigator.geolocation) {
      setGeoPending(false);
      setGeoError("Браузер не поддерживает геолокацию");
      return;
    }
    const timer = window.setTimeout(() => {
      setGeoPending(false);
      setGeoError("Не удалось быстро определить местоположение");
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        setGeoPending(false);
        const lngLat: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setMyPos(lngLat);
        setLocation({ center: lngLat, zoom: 15 });
      },
      (err) => {
        window.clearTimeout(timer);
        setGeoPending(false);
        setGeoError(err.message || "Геолокация недоступна");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [apiReady]);

  const recenterToMe = () => myPos && setLocation({ center: myPos, zoom: 15 });

  return { myPos, geoPending, geoError, location, setLocation, recenterToMe };
}
