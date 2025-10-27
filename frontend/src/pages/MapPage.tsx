import { useEffect, useRef, useState } from "react";
import type * as ymapsNS from "yandex-maps";
import { loadYmaps } from "../lib/loadYmaps";
// сверху файла
import type { MutableRefObject } from "react";

type Coord = [number, number];

export default function MapPage() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymapsNS.Map | null>(null);

  // refs для текущих объектов на карте
  const myPosRef = useRef<Coord | null>(null);
  const myPlacemarkRef = useRef<ymapsNS.Placemark | null>(null);
  const eventPlacemarkRef = useRef<ymapsNS.Placemark | null>(null);
  const routeRef = useRef<ymapsNS.multiRouter.MultiRoute | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const [apiReady, setApiReady] = useState(false);
  const [myPos, setMyPos] = useState<Coord | null>(null);
  const [eta, setEta] = useState("");

  // загрузка SDK (один раз)
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
      center: [55.751244, 37.618423],
      zoom: 12,
      controls: ["zoomControl", "geolocationControl"],
    });
    mapRef.current = map;

    // корректный размер
    map.container.fitToViewport();
    const onResize = () => map.container.fitToViewport();
    window.addEventListener("resize", onResize);
    roRef.current = new ResizeObserver(onResize);
    roRef.current.observe(mapNodeRef.current);

    // геолокация один раз
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMyPos([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    // клик по карте = выбрать событие
    map.events.add("click", (ev: ymapsNS.IEvent) => {
      const coordsArr = ev.get("coords") as number[];
      const coords: Coord = [coordsArr[0], coordsArr[1]];

      // убрать старый "событийный" пин
      if (eventPlacemarkRef.current) {
        map.geoObjects.remove(eventPlacemarkRef.current);
        eventPlacemarkRef.current = null;
      }
      // добавить новый
      eventPlacemarkRef.current = new ym.Placemark(
        coords,
        { hintContent: "Событие" },
        { preset: "islands#redIcon" }
      );
      map.geoObjects.add(eventPlacemarkRef.current);

      // построить маршрут, если есть моя позиция
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

  // держим актуальное значение позиции в ref (для обработчиков)
  useEffect(() => {
    myPosRef.current = myPos;
  }, [myPos]);

  // когда пришла моя позиция – ставим/перемещаем пин и центрируем карту
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

    mapRef.current.setCenter(myPos, 14, { duration: 200 });
  }, [myPos]);

  return (
    <div className="h-full w-full">
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
  from: [number, number],
  to: [number, number],
  setEta: (txt: string) => void,
  routeRef: MutableRefObject<ymapsNS.multiRouter.MultiRoute | null>
) {
  // удалить предыдущий маршрут
  if (routeRef.current) {
    map.geoObjects.remove(routeRef.current);
    routeRef.current = null;        // ✅ без any
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

