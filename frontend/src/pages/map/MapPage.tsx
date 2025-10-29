// src/pages/map/MapPage.tsx
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

// всплывающее меню создания на карте (ПКМ / long-press)
// (импорт оставляем при необходимости, но в этом файле используем собственный div-попап)
// import ContextCreateMenu from "./ui/balloons/ContextCreateMenu";

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
  const lastBoundsRef = useRef<any>(null);

  // заявки/оверлап
  const { mine, loadMine, handleApply, withdrawByEvent, findByEventId } = useApplyWithOverlap();
  useEffect(() => {
    if (isAuthed) loadMine();
  }, [isAuthed, loadMine]);

  // выбранный маркер и нажатие (виз. эффект)
  const [selected, setSelected] = useState<{ e: AppEvent; coords: LngLat } | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);

  // контекстное меню для создания события/тренировки
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Кеш последних геокоординат ПКМ из YMapListener
  const lastGeoRef = useRef<[number, number] | null>(null); // [lon, lat]

  // безопасные обработчики (не дергают API, если аноним)
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

  // переход в форму создания с подстановкой координат (оставляем как у тебя)
  const openCreate = (kind: "EVENT" | "TRAINING", lat: number, lon: number) => {
    const params = new URLSearchParams({
      kind,
      lat: String(lat),
      lon: String(lon),
    });
    navigate(`/event/new?${params.toString()}`);
    setCtxMenu(null);
  };

  // закрывать попап при уходе ниже порога
  useEffect(() => {
    if (!selected) return;
    const isTraining = (selected.e.kind || "EVENT").toUpperCase() === "TRAINING";
    const needed = isTraining ? Z_TRAININGS_FETCH : Z_EVENTS_FETCH;
    if (zoom < needed) setSelected(null);
  }, [zoom, selected]);

  // === Обработчик ПКМ на контейнере карты (оставляем) ===
  // Берём экранные координаты для позиционирования попапа,
  // а геокоординаты — из lastGeoRef (которые установит YMapListener), иначе — центр.
  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const coords = lastGeoRef.current ?? [location.center[0], location.center[1]] as [number, number];

    setCtxMenu({
      coords, // [lon, lat]
      screenX: x,
      screenY: y
    });
    
    setSelected(null);
  };

  // Закрываем контекстное меню при ЛКМ вне меню
  useEffect(() => {
    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return; // только левая кнопка
      if (!menuRef.current) return;
      const path = ev.composedPath();
      if (!path.includes(menuRef.current)) setCtxMenu(null);
    };
    const onEsc = (ev: KeyboardEvent) => { if (ev.key === "Escape") setCtxMenu(null); };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", onEsc);
    };
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
      onContextMenu={handleContainerContextMenu} // не удаляем — он даёт экранную позицию
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

      {/* Контекстное меню (старый попап) */}
      {ctxMenu && (
        <div 
          ref={menuRef}
          className="absolute z-50 bg-white rounded-lg shadow-lg p-2 min-w-[160px]"
          style={{
            left: ctxMenu.screenX,
            top: ctxMenu.screenY,
          }}
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
        location={location} 
        className="w-full h-full" 
        showScaleInCopyrights
      >
        <YMapDefaultSchemeLayer />
        <YMapDefaultFeaturesLayer />

        <YMapListener
          onUpdate={(e: any) => {
            const loc = e?.location;
            onMapUpdate(loc);
            if (loc?.bounds) lastBoundsRef.current = loc.bounds;

            if (loc?.zoom && loc.zoom >= Z_EVENTS_FETCH) {
              const b = loc?.bounds;
              if (b) handleBounds(b);
            } else {
              cancel();
            }
          }}
          onClick={() => {
            setSelected(null);
            setCtxMenu(null);
          }}
          onContextMenu={(e: any) => {
            // Альтернативный обработчик ПКМ через YMapListener — достаём ТОЧНЫЕ гео
            e?.originalEvent?.preventDefault?.();
            const c = e?.coordinates; // [lon, lat]
            if (Array.isArray(c) && c.length === 2) {
              lastGeoRef.current = c as [number, number]; // кеш гео

              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCtxMenu({
                  coords: lastGeoRef.current,
                  screenX: e.originalEvent.clientX - rect.left,
                  screenY: e.originalEvent.clientY - rect.top
                });
                setSelected(null);
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

          // отсечки по зуму + размер окна
          if (isTraining) {
            if (viewportDiagKm > MAX_TRAININGS_VIEW_KM) return null;
            if (zoom < Z_TRAININGS_FETCH) return null;
          } else {
            if (zoom < Z_EVENTS_FETCH) return null;
          }

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

      {/* Bottom-sheet (показывается и анониму, просто без действий) */}
      <MyTrainingsSheet mine={mine} myPos={myPos} onWithdraw={onWithdrawSafe} />
    </div>
  );
}
