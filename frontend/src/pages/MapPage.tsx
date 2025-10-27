import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type * as ymapsNS from "yandex-maps";
import { loadYmaps } from "../lib/loadYmaps";

type Coord = [number, number];

export default function MapPage() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymapsNS.Map | null>(null);

  const myPosRef = useRef<Coord | null>(null);
  const myPlacemarkRef = useRef<ymapsNS.Placemark | null>(null);
  const eventPlacemarkRef = useRef<ymapsNS.Placemark | null>(null);
  const routeRef = useRef<ymapsNS.multiRouter.MultiRoute | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const [apiReady, setApiReady] = useState(false);
  const [myPos, setMyPos] = useState<Coord | null>(null);
  const [eta, setEta] = useState("");

  // >>> NEW: оверлей "определяем местоположение"
  const [geoPending, setGeoPending] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const initialCenteredRef = useRef(false); // центрировали ли карту уже один раз

  // загрузка SDK
  useEffect(() => {
    loadYmaps(import.meta.env.VITE_YANDEX_MAPS_API_KEY as string, "ru_RU")
      .then(() => setApiReady(true))
      .catch(console.error);
  }, []);

  // инициализация карты (один раз)
  useEffect(() => {
    if (!apiReady || !mapNodeRef.current || !window.ymaps || mapRef.current) return;
    const ym = window.ymaps as typeof ymapsNS;

    const map = new ym.Map(mapNodeRef.current, {
      center: [55.751244, 37.618423],   // временный центр (Москва)
      zoom: 12,
      controls: ["zoomControl", "geolocationControl"],
    });
    mapRef.current = map;

    map.container.fitToViewport();
    const onResize = () => map.container.fitToViewport();
    window.addEventListener("resize", onResize);
    roRef.current = new ResizeObserver(onResize);
    roRef.current.observe(mapNodeRef.current);

    // геолокация один раз (с таймаутом)
    if (navigator.geolocation) {
      const timer = setTimeout(() => {
        setGeoPending(false);           // убираем лоадер по таймауту
        setGeoError("Не удалось быстро определить местоположение");
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          setMyPos([pos.coords.latitude, pos.coords.longitude]);
          setGeoPending(false);
        },
        (err) => {
          clearTimeout(timer);
          setGeoPending(false);
          setGeoError(err.message || "Геолокация недоступна");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGeoPending(false);
      setGeoError("Браузер не поддерживает геолокацию");
    }

    // выбор события кликом
    map.events.add("click", (ev: ymapsNS.IEvent) => {
      const coordsArr = ev.get("coords") as number[];
      const coords: Coord = [coordsArr[0], coordsArr[1]];

      if (eventPlacemarkRef.current) {
        map.geoObjects.remove(eventPlacemarkRef.current);
        eventPlacemarkRef.current = null;
      }
      eventPlacemarkRef.current = new ym.Placemark(
        coords,
        { hintContent: "Событие" },
        { preset: "islands#redIcon" }
      );
      map.geoObjects.add(eventPlacemarkRef.current);

      if (myPosRef.current) {
        buildRoute(ym, map, myPosRef.current, coords, setEta, routeRef);
      }
    });

    return () => {
      window.removeEventListener("resize", onResize);
      roRef.current?.disconnect();
      map.destroy();
      mapRef.current = null;
    };
  }, [apiReady]);

  // держим актуальную позицию в ref
  useEffect(() => {
    myPosRef.current = myPos;
  }, [myPos]);

  // как только пришла моя позиция — ставим пин и ОДИН РАЗ центрируем карту (zoom 15)
  useEffect(() => {
    if (!myPos || !mapRef.current || !window.ymaps) return;
    const ym = window.ymaps as typeof ymapsNS;

    if (!myPlacemarkRef.current) {
      myPlacemarkRef.current = new ym.Placemark(
        myPos,
        { hintContent: "Вы здесь" },
        { preset: "islands#blueCircleIcon" }
      );
      mapRef.current.geoObjects.add(myPlacemarkRef.current);
    } else {
      myPlacemarkRef.current.geometry?.setCoordinates(myPos);
    }

    if (!initialCenteredRef.current) {
      mapRef.current.setCenter(myPos, 15, { duration: 200 });
      initialCenteredRef.current = true;
    }
  }, [myPos]);

  // кнопка "моё место"
  const recenterToMe = () => {
    if (myPosRef.current && mapRef.current) {
      mapRef.current.setCenter(myPosRef.current, 15, { duration: 200 });
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Оверлей загрузки геолокации */}
      {geoPending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-sm">
          <div className="animate-pulse text-sm text-gray-700">
            Определяем ваше местоположение…
          </div>
        </div>
      )}

      {/* Сообщение об ошибке геолокации (не блокирует карту) */}
      {!geoPending && geoError && (
        <div className="absolute top-3 left-3 z-20 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow">
          {geoError}
        </div>
      )}

      {/* Кнопка «моё место» */}
      <button
        onClick={recenterToMe}
        className="absolute right-3 top-3 z-20 rounded-full bg-white/95 px-3 py-1 text-sm shadow"
      >
        Моё место
      </button>

      {eta && (
        <div className="absolute z-10 m-3 rounded-xl bg-black/70 text-white px-3 py-2">
          {eta}
        </div>
      )}

      <div ref={mapNodeRef} style={{ width: "100%", height: "100%" }} />

      <div className="absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 text-sm shadow">
        Кликни на карте, чтобы выбрать место события
      </div>
    </div>
  );
}

function buildRoute(
  ym: typeof ymapsNS,
  map: ymapsNS.Map,
  from: Coord,
  to: Coord,
  setEta: (txt: string) => void,
  routeRef: MutableRefObject<ymapsNS.multiRouter.MultiRoute | null>
) {
  if (routeRef.current) {
    map.geoObjects.remove(routeRef.current);
    routeRef.current = null;
  }

  const route = new ym.multiRouter.MultiRoute(
    { referencePoints: [from, to], params: { routingMode: "pedestrian" as const } },
    { boundsAutoApply: true }
  );

  route.model.events.add("requestsuccess", () => {
    const active = route.getActiveRoute();
    if (!active) return;
    type Metric = { text: string; value: number };
    const dist = active.properties.get("distance", {}) as Partial<Metric>;
    const dur  = active.properties.get("duration", {}) as Partial<Metric>;
    const km = ((dist.value ?? 0) / 1000).toFixed(1);
    const min = Math.round((dur.value ?? 0) / 60);
    setEta(`${km} км • ~${min} мин пешком`);
  });

  map.geoObjects.add(route);
  routeRef.current = route;
}
