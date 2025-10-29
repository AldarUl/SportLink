// src/pages/MapPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { loadYmaps3 } from "@/lib/loadYmaps3";
import { useEventStore } from "@/entities/event/store";
import type { Event as AppEvent } from "@/entities/event/types";
import { useApplicationStore } from "@/entities/application/store";
import { willOverlapWithAny } from "@/shared/schedule";

type LngLat = [number, number];

// Пороги зума и физический размер окна
const Z_EVENTS_FETCH = 11;          // события (ромбы)
const Z_TRAININGS_FETCH = 13;       // тренировки (синие кружки) — делаем ближе
const MAX_TRAININGS_VIEW_KM = 8;    // тренировки показываем, если диагональ окна ≤ 8 км
const MAX_EVENTS_VIEW_KM = 80;      // (опц.) события тянем до 80 км диагонали

// Грубая haversine для км
function kmBetween([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function MapPage() {
  const navigate = useNavigate();
  const { events } = useEventStore();

  const [apiReady, setApiReady] = useState(false);
  const [Y, setY] = useState<any>(null);

  const [location, setLocation] = useState({
    center: [37.618423, 55.751244] as LngLat,
    zoom: 12,
  });

  const [myPos, setMyPos] = useState<LngLat | null>(null);
  const [geoPending, setGeoPending] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ e: AppEvent; coords: LngLat } | null>(null);
  const [zoom, setZoom] = useState<number>(12);
  const [viewportDiagKm, setViewportDiagKm] = useState<number>(Infinity); // <-- теперь внутри компонента

  const [pressedId, setPressedId] = useState<string | null>(null);

  // актуальный zoom для дебаунса
  const zoomRef = useRef<number>(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // если ушли ниже порога — закрываем открытый попап
  useEffect(() => {
    if (!selected) return;
    const isTraining = (selected.e.kind || "EVENT").toUpperCase() === "TRAINING";
    const needed = isTraining ? Z_TRAININGS_FETCH : Z_EVENTS_FETCH;
    if (zoom < needed) setSelected(null);
  }, [zoom, selected]);

  // --- Yandex Maps v3 + reactify ---
  useEffect(() => {
    (async () => {
      await loadYmaps3(import.meta.env.VITE_YANDEX_MAPS_API_KEY as string, "ru_RU");
      const ym3 = (window as any).ymaps3;
      const [ymaps3React] = await Promise.all([ym3.import("@yandex/ymaps3-reactify"), ym3.ready]);
      const reactify = ymaps3React.reactify.bindTo(React, ReactDOM);
      const base = reactify.module(ym3);
      setY(base);
      setApiReady(true);
    })();
  }, []);

  // ---- Application store ----
  const {
    mine,
    loadMine,
    apply: applyAction,
    withdrawByEvent,
    findByEventId,
  } = useApplicationStore();

  useEffect(() => { loadMine(); }, [loadMine]);

  // --- Geolocation ---
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
        setZoom(15);
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

  // --- Debounced viewport fetch ---
  const debounceRef = useRef<number | null>(null);
  const lastViewportKeyRef = useRef<string>("");

  const debouncedFetchViewport = (bbox: {
    minLat: number; minLon: number; maxLat: number; maxLon: number;
  }) => {
    // не трогаем бэк если не достигнут порог событий или окно слишком большое
    if (zoomRef.current < Z_EVENTS_FETCH || viewportDiagKm > MAX_EVENTS_VIEW_KM) {
      if (debounceRef.current) { window.clearTimeout(debounceRef.current); debounceRef.current = null; }
      return;
    }
    const key =
      `${bbox.minLat.toFixed(3)}|${bbox.minLon.toFixed(3)}|${bbox.maxLat.toFixed(3)}|${bbox.maxLon.toFixed(3)}`;
    if (key === lastViewportKeyRef.current) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (zoomRef.current < Z_EVENTS_FETCH || viewportDiagKm > MAX_EVENTS_VIEW_KM) return;
      lastViewportKeyRef.current = key;
      useEventStore.getState().fetchViewport(bbox);
    }, 350);
  };

  const handleBounds = (b: any) => {
    if (!Array.isArray(b) || !Array.isArray(b[0]) || !Array.isArray(b[1])) return;
    const [[minLng, minLat], [maxLng, maxLat]] = b as [[number, number],[number, number]];
    debouncedFetchViewport({ minLat, minLon: minLng, maxLat, maxLon: maxLng });
  };

  // --- Apply with overlap check ---
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

  const markers = useMemo(
    () => (events as AppEvent[]).filter(e => e.locationLat != null && e.locationLon != null),
    [events]
  );

  if (!apiReady || !Y) return <div className="w-full h-full" />;

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapMarker,
    YMapListener,
  } = Y;

  return (
    <div className="relative h-full w-full">
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

      <button
        onClick={recenterToMe}
        className="absolute right-3 top-3 z-20 rounded-full bg-white/95 px-3 py-1 text-sm shadow"
      >
        Моё место
      </button>

      <YMap location={location} className="w-full h-full" showScaleInCopyrights>
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />

        <YMapListener
          onUpdate={(e: any) => {
            const loc = e?.location;
            if (loc?.zoom) setZoom(loc.zoom);

            // вычисляем диагональ текущих bounds
            let diag = viewportDiagKm;
            if (Array.isArray(loc?.bounds)) {
              const [[minLng, minLat], [maxLng, maxLat]] = loc.bounds as [[number,number],[number,number]];
              diag = kmBetween([minLng, minLat], [maxLng, maxLat]);
              setViewportDiagKm(diag);
            }

            // бек дергаем только если достигли порога событий И окно не гигантское
            if (loc?.zoom && loc.zoom >= Z_EVENTS_FETCH && diag <= MAX_EVENTS_VIEW_KM) {
              const b = loc?.bounds;
              if (b) handleBounds(b);
            } else {
              if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
              }
            }
          }}
          onClick={() => setSelected(null)}
        />

        {/* Я */}
        {myPos && (
          <YMapMarker coordinates={myPos} zIndex={1000}>
            <div className="sl-pin sl-pin--user" title="Вы здесь" />
          </YMapMarker>
        )}

        {/* События/тренировки */}
        {markers.map((e) => {
          const coords: LngLat = [e.locationLon as number, e.locationLat as number];
          const isTraining = (e.kind || "EVENT").toUpperCase() === "TRAINING";

          // отсечки по зуму + физическому размеру окна
          if (isTraining) {
            if (zoom < Z_TRAININGS_FETCH) return null;
            if (viewportDiagKm > MAX_TRAININGS_VIEW_KM) return null;
          } else {
            if (zoom < Z_EVENTS_FETCH) return null;
            // (опц.) для событий можно не ограничивать по км
          }

          const hasApp = Boolean(findByEventId(e.id));
          const active = selected?.e.id === e.id;

          // мини-бейдж показываем синхронно с маркером
          const showMini = !active && (isTraining
            ? (zoom >= Z_TRAININGS_FETCH && viewportDiagKm <= MAX_TRAININGS_VIEW_KM)
            : (zoom >= Z_EVENTS_FETCH));

          const title = e.title;
          const subtitle =
            `${e.kind === "TRAINING" ? "Тренировка" : "Событие"} • ${e.sport ?? ""} • ${formatDateTime(e.startsAt)}`;

          // размеры
          const PIN  = isTraining ? 34 : 52;
          const TAIL = isTraining ?  9 : 12;
          const HALO = isTraining ?  0 : 12;

          const wrapStyle: React.CSSProperties = {
            width: `${PIN + 2 * HALO}px`,
            height: `${PIN + TAIL + 2 * HALO}px`,
            transform: `translate(${(-0.5 * (PIN + 2 * HALO))}px, ${(-1 * (PIN + TAIL + 2 * HALO))}px)`,
          };

          const pinStyle: React.CSSProperties = {
            left: `${HALO}px`,
            bottom: `${TAIL + HALO}px`,
            width: `${PIN}px`,
            height: `${PIN}px`,
            transform: pressedId === e.id ? "scale(0.96)" : undefined,
            transition: pressedId === e.id ? "transform 60ms ease-out, box-shadow 80ms ease" : undefined,
            boxShadow: pressedId === e.id ? "0 0 0 3px #fff, 0 6px 14px rgba(0,0,0,.26)" : undefined,
          };
          const auraStyle: React.CSSProperties = {
            left: `${HALO}px`,
            bottom: `${TAIL + HALO}px`,
            width: `${PIN}px`,
            height: `${PIN}px`,
          };

          return (
            <React.Fragment key={e.id}>
              <YMapMarker coordinates={coords} zIndex={active ? 1500 : (isTraining ? 900 : 1100)}>
                <div
                  className={`sl-pin-wrap ${isTraining ? "sl-wrap--training" : "sl-wrap--event"} ${active ? "sl-wrap--active" : ""}`}
                  style={wrapStyle}
                  onClick={(ev) => { ev.stopPropagation(); setSelected({ e, coords }); }}
                  title={title}
                >
                  {/* АУРА — только для событий */}
                  {!isTraining && (
                    <span className={`sl-aura ${active ? "sl-aura--active" : ""}`} style={auraStyle} aria-hidden="true" />
                  )}

                  {/* РОМБОВЫЕ ВОЛНЫ — только для событий */}
                  {!isTraining && (
                    <div className="sl-ripples" aria-hidden="true">
                      <span></span><span></span><span></span>
                    </div>
                  )}

                  {/* тело пина */}
                  <div
                    className={`sl-pin ${isTraining ? "sl-pin--training" : "sl-pin--event"} ${active ? "sl-pin--active" : ""}`}
                    style={pinStyle}
                    onPointerDown={() => setPressedId(e.id)}
                    onPointerUp={() => setPressedId(null)}
                    onPointerCancel={() => setPressedId(null)}
                    onPointerLeave={() => setPressedId(null)}
                  >
                    {active && <span className="sl-shine" />}
                    <span className="sl-band" />
                  </div>

                  {/* мини-лейбл */}
                  {showMini && (
                    <div
                      className={`sl-badge ${!isTraining ? "sl-badge--event" : ""}`}
                      onClick={(ev) => { ev.stopPropagation(); setSelected({ e, coords }); }}
                    >
                      <div className="sl-badge__title">
                        {!isTraining && <span className="sl-chip sl-chip--event">СОБЫТИЕ</span>}
                        <span className={!isTraining ? "ml-1" : ""}>{title}</span>
                      </div>
                      <div className={`sl-badge__sub ${!isTraining ? "sl-badge__sub--event" : ""}`}>
                        {subtitle}
                      </div>
                    </div>
                  )}

                  {/* POPUP */}
                  {active && (
                    <div className="sl-popover" onClick={(ev) => ev.stopPropagation()}>
                      <PopupCard
                        e={e}
                        myPos={myPos}
                        coords={coords}
                        hasApp={hasApp}
                        onApply={handleApply}
                        onWithdraw={(eventId) => withdrawByEvent(eventId)}
                        onClose={() => setSelected(null)}
                        onMore={() => navigate(`/event/${e.id}`)}
                      />
                    </div>
                  )}
                </div>
              </YMapMarker>
            </React.Fragment>
          );
        })}
      </YMap>

      {/* Bottom-sheet */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 mx-auto w-[min(960px,95%)]">
        <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-xl">
          <div className="mb-2 text-sm font-semibold text-gray-700">Мои ближайшие тренировки</div>
          <div className="flex flex-wrap gap-3">
            {mine
              .filter(a => a.event && (a.status === "CONFIRMED" || a.status === "PENDING"))
              .sort((a, b) => new Date(a.event!.startsAt).getTime() - new Date(b.event!.startsAt).getTime())
              .slice(0, 3)
              .map((a) => (
                <div key={a.id} className="flex min-w-[260px] flex-1 items-center justify-between rounded-xl border px-3 py-2">
                  <div>
                    <div className="font-medium">{a.event?.title ?? "Тренировка"}</div>
                    <div className="text-xs text-gray-500">{a.event ? formatDateTime(a.event.startsAt) : ""}</div>
                    <div className="text-[11px] text-gray-500">Статус: {a.status}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-md border px-2 py-1 text-xs"
                      onClick={() => {
                        const to: LngLat | null =
                          a.event?.locationLat != null && a.event?.locationLon != null
                            ? [a.event.locationLon!, a.event.locationLat!]
                            : null;
                        if (to) openRouteExternal(myPos ?? undefined, to);
                      }}
                    >
                      Маршрут
                    </button>
                    <button
                      className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
                      onClick={() => a.event && withdrawByEvent(a.event.id)}
                    >
                      Отозвать
                    </button>
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

function PopupCard({
  e, myPos, coords, hasApp, onApply, onWithdraw, onClose, onMore,
}: {
  e: AppEvent;
  myPos: [number, number] | null;
  coords: [number, number];
  hasApp: boolean;
  onApply: (e: AppEvent) => void;
  onWithdraw: (eventId: string) => void;
  onClose: () => void;
  onMore: () => void;
}) {
  return (
    <div className="relative w-72 rounded-xl bg-white p-3 shadow-xl border border-neutral-200/60">
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded px-2 text-sm text-gray-500 hover:bg-gray-100"
        aria-label="Закрыть"
      >
        ×
      </button>
      <div className="font-semibold">{e.title}</div>
      <div className="mt-1 text-[12px] text-gray-500">
        {(e.kind === "TRAINING" ? "Тренировка" : "Событие")} • {e.sport ?? ""} • {formatDateTime(e.startsAt)}
      </div>
      {e.description && <div className="mt-2 text-[13px]">{e.description}</div>}
      <div className="mt-3 flex gap-2">
        <button className="sl-btn" onClick={() => openRouteExternal(myPos ?? undefined, coords)}>Маршрут</button>
        {!hasApp ? (
          <button className="sl-btn sl-btn--primary" onClick={() => onApply(e)}>Записаться</button>
        ) : (
          <button className="sl-btn" onClick={() => onWithdraw(e.id)}>Отозвать</button>
        )}
        <button className="sl-btn" onClick={onMore}>Подробнее</button>
      </div>
    </div>
  );
}

function formatDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function openRouteExternal(from?: [number, number], to?: [number, number]) {
  if (!to) return;
  const rtext = from ? `${from[1]},${from[0]}~${to[1]},${to[0]}` : `~${to[1]},${to[0]}`;
  window.open(`https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`, "_blank");
}
