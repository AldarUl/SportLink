// src/pages/MapPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom"; // для reactify.bindTo
import { loadYmaps3 } from "@/lib/loadYmaps3";
import { useEventStore } from "@/entities/event/store";
import type { Event as AppEvent } from "@/entities/event/types";





// ВАЖНО для v3: порядок координат [lng, lat]
type LngLat = [number, number];

export default function MapPage() {
  const { events } = useEventStore();

  const [apiReady, setApiReady] = useState(false);
  const [Y, setY] = useState<any>(null);
  const [UI, setUI] = useState<any>(null);

  // Текущее положение камеры
  const [location, setLocation] = useState({
    center: [37.618423, 55.751244] as LngLat,
    zoom: 12,
  });

  // Геолокация
  const [myPos, setMyPos] = useState<LngLat | null>(null);
  const [geoPending, setGeoPending] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [eta, setEta] = useState("");



  // === ЗАГРУЗКА API V3 + reactify ===
useEffect(() => {
  (async () => {
    await loadYmaps3(import.meta.env.VITE_YANDEX_MAPS_API_KEY as string, "ru_RU");
    const ym3 = (window as any).ymaps3;

    // 👇 было bindTo(React) — нужно bindTo(React, ReactDOM)
    const [ymaps3React] = await Promise.all([
      ym3.import("@yandex/ymaps3-reactify"),
      ym3.ready,
    ]);

    const reactify = ymaps3React.reactify.bindTo(React, ReactDOM);
    const base = reactify.module(ym3);
    const theme = reactify.module(await ym3.import("@yandex/ymaps3-default-ui-theme"));

    setY(base);
    setUI(theme);
    setApiReady(true);
  })();
}, []);




  // === ГЕОЛОКАЦИЯ ===
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

  const recenterToMe = () => {
    if (myPos) setLocation({ center: myPos, zoom: 15 });
  };

  // === ФЕТЧ ПО ВЬЮПОРТУ (debounce) ===
  const debounceRef = useRef<number | null>(null);
  const debouncedFetchViewport = (bbox: {
    minLat: number; minLon: number; maxLat: number; maxLon: number;
  }) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      useEventStore.getState().fetchViewport(bbox);
    }, 350);
  };

  // Преобразуем bounds из v3 ([ [minLng,minLat], [maxLng,maxLat] ]) к нашему API
  const handleBounds = (b: any) => {
    if (!Array.isArray(b) || !Array.isArray(b[0]) || !Array.isArray(b[1])) return;
    const [[minLng, minLat], [maxLng, maxLat]] = b as [[number, number],[number, number]];
    debouncedFetchViewport({
      minLat, minLon: minLng,
      maxLat, maxLon: maxLng,
    });
  };




function PopupContent({
  e,
  myPos,
  coords,
}: {
  e: AppEvent;
  myPos: [number, number] | null;
  coords: [number, number];
}) {
  return (
    <div style={{ minWidth: 240 }}>
      <div style={{ fontWeight: 600 }}>{e.title}</div>
      <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0" }}>
        {(e.kind === "TRAINING" ? "Тренировка" : "Событие") +
          " • " +
          (e.sport ?? "") +
          " • " +
          formatDateTime(e.startsAt)}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.3 }}>
        {e.description ?? ""}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          className="sl-btn"
          onClick={() => openRouteExternal(myPos ?? undefined, coords)}
        >
          Маршрут
        </button>
        <button
          className="sl-btn sl-btn--primary"
          onClick={() => console.log("join", e.id)}
        >
          Записаться
        </button>
      </div>
    </div>
  );
}

  // === МАРКЕРЫ ===
  const markers = useMemo(
    () => (events as AppEvent[]).filter(e => e.locationLat != null && e.locationLon != null),
    [events]
  );

  if (!apiReady || !Y || !UI) {
    return <div className="w-full h-full" />;
  }

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapMarker,
    YMapListener,   // слушаем обновления камеры, чтобы звать fetchViewport
  } = Y;

  const { YMapDefaultMarker } = UI;

  return (
    <div className="relative h-full w-full">
      {/* геолокация */}
      {geoPending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-sm">
          <div className="animate-pulse text-sm text-gray-700">Определяем ваше местоположение…</div>
        </div>
      )}
      {!geoPending && geoError && (
        <div className="absolute top-3 left-3 z-20 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow">
          {geoError}
        </div>
      )}

      {/* кнопка "моё место" */}
      <button
        onClick={recenterToMe}
        className="absolute right-3 top-3 z-20 rounded-full bg-white/95 px-3 py-1 text-sm shadow"
      >
        Моё место
      </button>

      {/* ETA (placeholder) */}
      {eta && (
        <div className="absolute z-10 m-3 rounded-xl bg-black/70 text-white px-3 py-2">{eta}</div>
      )}

      {/* КАРТА v3 */}
      <YMap location={location} className="w-full h-full" showScaleInCopyrights>
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />

        {/* Слушаем обновления камеры: при первом рендере тоже приходит */}
        <YMapListener
          // e.location.bounds — текущие границы вьюпорта (в координатах карты)
          onUpdate={(e: any) => {
            const b = e?.location?.bounds;
            if (b) handleBounds(b);
          }}
        />

        {/* Мой маркер */}
        {myPos && (
          <YMapMarker coordinates={myPos} zIndex={1000}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 8,
                background: "#2563eb",
                border: "3px solid #fff",
                boxShadow: "0 6px 18px rgba(0,0,0,.25)",
              }}
              title="Вы здесь"
            />
          </YMapMarker>
        )}

{/* События/тренировки */}
{markers.map((e) => {
  const coords: LngLat = [e.locationLon as number, e.locationLat as number];
  const color =
    (e.kind || "EVENT").toUpperCase() === "TRAINING" ? "lightblue" : "orange";

  return (
    <YMapDefaultMarker
      key={e.id}
      coordinates={coords}
      color={color}
      size="normal"
      title={e.title}
      subtitle={`${e.kind === "TRAINING" ? "Тренировка" : "Событие"} • ${e.sport ?? ""} • ${formatDateTime(e.startsAt)}`}
      popup={{
        position: "right",
        content: <PopupContent e={e} myPos={myPos} coords={coords} />,
      }}
    />
  );
})}


      </YMap>

      {/* подсказка снизу-слева */}
      <div className="absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 text-sm shadow pointer-events-none">
        Кликни на карте, чтобы выбрать место события
      </div>

      {/* Правый сайдбар */}
      <div className="pointer-events-none absolute right-3 top-16 z-20 flex w-[320px] flex-col gap-3">
        <div className="pointer-events-auto">
          <Card title="Тренировки ваших клубов">
            <MiniItem title="Boxing — Sat 18:00" meta="Клуб «Спарта» · м. Парк Культуры" />
            <MiniItem title="Running — Sun 09:00" meta="Клуб «Койоты» · Воробьёвы горы" />
          </Card>
        </div>
        <div className="pointer-events-auto">
          <Card title="Рядом">
            <MiniItem title="City Run 5k" meta="Сегодня · 2.1 км" />
            <MiniItem title="CrossFit WOD" meta="Завтра · 1.3 км" />
          </Card>
        </div>
      </div>

      {/* Bottom-sheet */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 mx-auto w-[min(960px,95%)]">
        <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-xl">
          <div className="mb-2 text-sm font-semibold text-gray-700">Мои ближайшие тренировки</div>
          <div className="flex flex-wrap gap-3">
            {(events.slice(0, 3) as AppEvent[]).map((e) => (
              <div key={e.id} className="flex min-w-[260px] flex-1 items-center justify-between rounded-xl border px-3 py-2">
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-gray-500">{formatDateTime(e.startsAt)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border px-2 py-1 text-xs"
                    onClick={() => {
                      const to: LngLat | null =
                        e.locationLat != null && e.locationLon != null
                          ? [e.locationLon, e.locationLat]
                          : null;
                      if (to) openRouteExternal(myPos ?? undefined, to);
                    }}
                  >
                    Маршрут
                  </button>
                  <button className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">Отозвать</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">* максимум 3 активные тренировки без пересечений по времени</div>
        </div>
      </div>
    </div>
  );
}

// ===== Утилиты =====
function formatDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}
function escapeHtml(s?: string) {
  return (s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
/** Быстрый маршрут: во внешних Яндекс.Картах */
function openRouteExternal(from?: [number, number], to?: [number, number]) {
  if (!to) return;
  const rtext = from
    ? `${from[1]},${from[0]}~${to[1]},${to[0]}`
    : `~${to[1]},${to[0]}`;
  window.open(`https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`, "_blank");
}

/** Малые карточки в правой колонке */
function Card({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/95 p-3 shadow">
      <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
function MiniItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-gray-500">{meta}</div>
    </div>
  );
}
