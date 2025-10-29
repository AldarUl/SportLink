import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventStore } from "@/entities/event/store";
import type { Event as AppEvent } from "@/entities/event/types";

import { useYmaps } from "./hooks/useYmaps";
import { useGeolocation } from "./hooks/useGeolocation";
import { useViewport } from "./hooks/useViewport";
import { useViewportFetch } from "./hooks/useViewportFetch";
import { useApplyWithOverlap } from "./hooks/useApplyWithOverlap";
import { useAuthStore } from "@/features/auth/store";

import { Z_EVENTS_FETCH, Z_TRAININGS_FETCH, MAX_TRAININGS_VIEW_KM } from "./lib/mapConfig";
import type { LngLat } from "./lib/geo";
import { GeoStatusOverlay } from "./ui/overlays/GeoStatusOverlay";
import { MyTrainingsSheet } from "./ui/overlays/MyTrainingsSheet";
import { EventMarker } from "./ui/markers/EventMarker";
import { TrainingMarker } from "./ui/markers/TrainingMarker";

import "./styles/mapPins.css";

// import ContextCreateMenu from "./ui/balloons/ContextCreateMenu";
import { CreateEventModal } from "./ui/modals/CreateEventModal";

type ContextMenuState = { 
  coords: [number, number]; // [lon, lat]
  screenX: number;
  screenY: number;
} | null;

export default function MapPage() {
  const navigate = useNavigate();
  const { events } = useEventStore();

  // ymaps API
  const { Y, apiReady } = useYmaps();

  // авторизация
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));

  // геолокация и позиция карты
  const { myPos, geoPending, geoError, location, recenterToMe } = useGeolocation(apiReady);

  // состояние вьюпорта и подгрузка ивентов по bbox
  const { zoom, viewportDiagKm, zoomRef, onMapUpdate } = useViewport();
  const { handleBounds, cancel } = useViewportFetch(zoomRef, () => viewportDiagKm);

  // заявки/оверлап
  const { mine, loadMine, handleApply, withdrawByEvent, findByEventId } = useApplyWithOverlap();
  useEffect(() => {
    if (isAuthed) loadMine();
  }, [isAuthed, loadMine]);

  // выбранный маркер и нажатие (виз. эффект)
  const [selected, setSelected] = useState<{ e: AppEvent; coords: LngLat } | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);

const lastBoundsRef = useRef<any>(null);

  // контекстное меню
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ref на экземпляр карты (нужен для screen->world)
  const mapRef = useRef<any>(null);

  // кеш последних геокоординат ПКМ
  const lastGeoRef = useRef<[number, number] | null>(null);

  // модалка создания
  const [createState, setCreateState] = useState<{
    kind: "EVENT" | "TRAINING";
    coords: LngLat; // [lon, lat]
  } | null>(null);

  // безопасные обработчики
  const onApplySafe = async (ev: AppEvent) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    await handleApply(ev);
  };
  const onWithdrawSafe = async (id: string) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    await withdrawByEvent(id);
  };

  // только ивенты с координатами
  const markers = useMemo(
    () => (events as AppEvent[]).filter((e) => e.locationLat != null && e.locationLon != null),
    [events]
  );

  // открыть модалку создания по координатам
  const openCreate = (kind: "EVENT" | "TRAINING", lat: number, lon: number) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    const coords: LngLat = [lon, lat];
    console.info("[Map] openCreate →", { kind, lat, lon, coordsLngLat: coords });
    setCreateState({ kind, coords }); // [lon, lat]
    setCtxMenu(null);
  };

  // закрывать попап при уходе ниже порога
  useEffect(() => {
    if (!selected) return;
    const isTraining = (selected.e.kind || "EVENT").toUpperCase() === "TRAINING";
    const needed = isTraining ? Z_TRAININGS_FETCH : Z_EVENTS_FETCH;
    if (zoom < needed) setSelected(null);
  }, [zoom, selected]);

  // утилита: экранные координаты → гео
  const screenToLngLat = (x: number, y: number): [number, number] | null => {
    try {
      const map = mapRef.current;
      if (map && typeof map.screenToWorld === "function") {
        return map.screenToWorld([x, y]) as [number, number]; // [lon, lat]
      }
    } catch (e) {
      console.warn("[Map] screenToWorld error:", e);
    }
    return null;
  };

  // ПКМ по контейнеру (всегда есть screen-координаты)
  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const fromScreen = screenToLngLat(x, y);            // приоритет №1
    const fromCache  = lastGeoRef.current;               // приоритет №2
    const fromCenter = [location.center[0], location.center[1]] as [number, number]; // фолбэк

    const coords = (fromScreen ?? fromCache ?? fromCenter) as [number, number];
    if (fromScreen) lastGeoRef.current = fromScreen;

    console.info("[Map] container onContextMenu", {
      screen: { x, y },
      geoFrom: fromScreen ? "screenToWorld" : (fromCache ? "cache" : "centerFallback"),
      coordsLngLat: coords,
    });

    setCtxMenu({ coords, screenX: x, screenY: y });
    setSelected(null);
  };

  // клик вне — закрываем контекстное меню
  useEffect(() => {
    const handleClickOutside = () => setCtxMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!apiReady || !Y) return <div className="w-full h-full" />;

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapMarker,
    YMapListener,
  } = Y;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      // onContextMenu={handleContainerContextMenu}
    >
      <GeoStatusOverlay pending={geoPending} error={geoError} />

      {/* Top-right actions */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        <button
          onClick={recenterToMe}
          className="rounded-full bg-white/95 px-3 py-1 text-sm shadow transition-colors hover:bg-white"
        >
          Моё место
        </button>
      </div>

      {/* Контекстное меню */}
      {ctxMenu && (
        <div
          className="absolute z-50 bg-white rounded-lg shadow-lg p-2 min-w-[160px]"
          style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => openCreate("EVENT", ctxMenu.coords[1], ctxMenu.coords[0])}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              Создать событие
            </button>
            <button
              onClick={() => openCreate("TRAINING", ctxMenu.coords[1], ctxMenu.coords[0])}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              Создать тренировку
            </button>
          </div>
        </div>
      )}

      <YMap
        ref={mapRef}
        location={location}
        className="w-full h-full"
        showScaleInCopyrights
      >
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />

        <YMapListener
          onUpdate={(e:any) => {
            const loc = e?.location;
            onMapUpdate(loc);

            // ===== TEMP OFF: порог зума и cancel() =====
            // if (loc?.zoom && loc.zoom >= Z_EVENTS_FETCH) {
            //   const b = loc?.bounds;
            //   if (b) { lastBoundsRef.current = b; handleBounds(b); }
            // } else {
            //   cancel();
            // }

            // Всегда дергаем bbox (для проверки)
            const b = loc?.bounds;
            if (b) {
              lastBoundsRef.current = b;
              handleBounds(b);
            }
          }}

          onClick={() => {
            setSelected(null);
            setCtxMenu(null);
          }}
          onContextMenu={(e: any) => {
            e?.originalEvent?.preventDefault?.();
            e?.originalEvent?.stopPropagation?.();           // <— важный стоп

            const c = e?.coordinates; // [lon, lat]
            if (Array.isArray(c) && c.length === 2) {
              lastGeoRef.current = c as [number, number];

              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const screenX = e.originalEvent.clientX - rect.left;
                const screenY = e.originalEvent.clientY - rect.top;

                setCtxMenu({ coords: c as [number, number], screenX, screenY });
                setSelected(null);
              }
              return;
            }

            // 2) фолбэк: экран → мир
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const x = e?.originalEvent?.clientX - rect.left;
              const y = e?.originalEvent?.clientY - rect.top;
              const world = screenToLngLat(x, y);
              if (world) {
                lastGeoRef.current = world;
                console.info("[Map] YMapListener onContextMenu (screenToWorld fallback)", {
                  geoLngLat: world,
                  screen: { x, y },
                });
                setCtxMenu({ coords: world, screenX: x, screenY: y });
                setSelected(null);
              } else {
                console.warn("[Map] YMapListener onContextMenu: no coordinates; screenToWorld failed");
              }
            }
          }}
        />

        {/* Я */}
        {myPos && (
          <YMapMarker coordinates={myPos} zIndex={1000}>
            <div className="sl-pin sl-pin--user" title="Вы здесь" />
          </YMapMarker>
        )}

        {/* Маркеры */}
        {markers.map((e) => {
          const coords: LngLat = [e.locationLon as number, e.locationLat as number];
          const isTraining = (e.kind || "EVENT").toUpperCase() === "TRAINING";

          // if (isTraining) {
          //   if (viewportDiagKm > MAX_TRAININGS_VIEW_KM) return null;
          //   if (zoom < Z_TRAININGS_FETCH) return null;
          // } else {
          //   if (zoom < Z_EVENTS_FETCH) return null;
          // }

          const hasApp = isAuthed && Boolean(findByEventId(e.id));
          const active = selected?.e.id === e.id;

          const commonProps = {
            YMapMarker,
            e,
            coords,
            active,
            hasApp,
            pressedId,
            setPressedId: (id: string | null) => setPressedId(id),
            onOpen: (ev: AppEvent, c: LngLat) => setSelected({ e: ev, coords: c }),
            onApply: onApplySafe,
            onWithdraw: onWithdrawSafe,
            onMore: () => navigate(`/event/${e.id}`),
            myPos,
            onClose: () => setSelected(null),
          };

          return isTraining
            ? <TrainingMarker key={e.id} {...commonProps} />
            : <EventMarker key={e.id} {...commonProps} />;
        })}
      </YMap>

      {/* Bottom-sheet */}
      <MyTrainingsSheet mine={mine} myPos={myPos} onWithdraw={onWithdrawSafe} />

      {/* Модалка создания */}
      {createState && (
        <CreateEventModal
          open
          kind={createState.kind}
          coords={createState.coords}
          onClose={() => setCreateState(null)}
          onCreated={(created) => {
            // 1) Оптимистично добавим в стор (если у стора есть add):
            try { useEventStore.getState().add?.(created); } catch {}

            // 2) И сразу перезапросим bbox, чтобы точно синхронизироваться с бэком
            if (lastBoundsRef.current) handleBounds(lastBoundsRef.current);

            setCreateState(null);
          }}
        />
      )}
    </div>
  );
}
