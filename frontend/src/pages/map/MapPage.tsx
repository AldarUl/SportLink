import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEventStore } from "@/entities/event/store";
import type { Event as AppEvent } from "@/entities/event/types";

import { useYmaps } from "./hooks/useYmaps";
import { useGeolocation } from "./hooks/useGeolocation";
import { useViewport } from "./hooks/useViewport";
import { useViewportFetch } from "./hooks/useViewportFetch";
import { useApplyWithOverlap } from "./hooks/useApplyWithOverlap";
import { useAuthStore } from "@/features/auth/store";

import { Z_EVENTS_FETCH, Z_TRAININGS_FETCH } from "./lib/mapConfig";
import type { LngLat } from "./lib/geo";
import { GeoStatusOverlay } from "./ui/overlays/GeoStatusOverlay";
import { MyTrainingsSheet } from "./ui/overlays/MyTrainingsSheet";
import { EventMarker } from "./ui/markers/EventMarker";
import { TrainingMarker } from "./ui/markers/TrainingMarker";

import "./styles/mapPins.css";
import { CreateEventModal } from "./ui/modals/CreateEventModal";

/* ===================== helpers ===================== */

type YBounds = [[number, number], [number, number]]; // [[lon1, lat1], [lon2, lat2]]

function normBounds(b: YBounds) {
  const [[lon1, lat1], [lon2, lat2]] = b;
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  return { minLon, maxLon, minLat, maxLat };
}

// Web-Mercator
const lat2merc = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI / 180) / 2));
const merc2lat = (m: number) => (Math.atan(Math.sinh(m)) * 180) / Math.PI;

/** Экран → гео без screenToWorld: через bounds + меркатор */
function screenToLngLatMercator(
  bounds: YBounds,
  containerW: number,
  containerH: number,
  x: number,
  y: number
): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = normBounds(bounds);

  // X — линейно, Y — в проекции Меркатора
  const tX = Math.min(Math.max(x / containerW, 0), 1);
  const tY = Math.min(Math.max(y / containerH, 0), 1);

  const lon = minLon + (maxLon - minLon) * tX;

  const mercMin = lat2merc(minLat);
  const mercMax = lat2merc(maxLat);
  // экранный Y идёт вниз, поэтому интерполируем «сверху вниз»
  const mercY = mercMax - (mercMax - mercMin) * tY;
  const lat = merc2lat(mercY);

  return [lon, lat];
}

/* ===================== component ===================== */

type ContextMenuState = {
  coords: [number, number]; // [lon, lat]
  screenX: number;
  screenY: number;
} | null;

type DragPreview = { kind: "EVENT" | "TRAINING"; coords: LngLat } | null;

export default function MapPage() {
  const navigate = useNavigate();

  // ⬇️ ВАЖНО: точечная подписка на массив событий (чтобы гарантированно перерисовываться)
  const events = useEventStore((s) => s.events);

  // ymaps API
  const { Y, apiReady } = useYmaps();

  // авторизация
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));

  // геолокация и позиция карты
  const { myPos, geoPending, geoError, location, recenterToMe } = useGeolocation(apiReady);

  // состояние вьюпорта и подгрузка ивентов по bbox
  const { zoom, zoomRef, onMapUpdate } = useViewport();
  const { handleBounds } = useViewportFetch(zoomRef, () => Infinity);

  // заявки/оверлап
  const { mine, loadMine, handleApply, withdrawByEvent, findByEventId } = useApplyWithOverlap();
  useEffect(() => { if (isAuthed) loadMine(); }, [isAuthed, loadMine]);

  // выбор/нажатие
  const [selected, setSelected] = useState<{ e: AppEvent; coords: LngLat } | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);

  // bounds/refs
  const lastBoundsRef = useRef<YBounds | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // контекстное меню
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);

  // drag-to-create
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);
  const [createState, setCreateState] = useState<{ kind: "EVENT" | "TRAINING"; coords: LngLat } | null>(null);

  // безопасные обработчики
  const onApplySafe = async (ev: AppEvent) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    await handleApply(ev);
  };
  const onWithdrawSafe = async (id: string) => {
    if (!isAuthed) { navigate("/auth/login"); return; }
    await withdrawByEvent(id);
  };

  // если выбранный элемент исчез из стора (удален) — закрыть попап
  useEffect(() => {
    if (selected && !events.some((x) => x.id === selected.e.id)) {
      setSelected(null);
    }
  }, [events, selected]);

  // только сущности с координатами
  const markers = useMemo(
    () =>
      (events as AppEvent[]).filter(
        (e) => e.locationLat != null && e.locationLon != null
      ),
    [events]
  );

  // drag image (чтобы курсор не прилипал к кнопке)
  const setNiceDragImage = (e: React.DragEvent, label = "•") => {
    const ghost = document.createElement("div");
    ghost.style.cssText =
      "width:24px;height:24px;border-radius:999px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;font:600 14px sans-serif";
    ghost.innerText = label;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  // обработчики drag&drop
  const handleDragStart = (e: React.DragEvent, kind: "EVENT" | "TRAINING") => {
    e.dataTransfer.setData("text/sportlink-kind", kind);
    e.dataTransfer.effectAllowed = "copy";
    setNiceDragImage(e, kind === "EVENT" ? "E" : "T");
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!containerRef.current || !lastBoundsRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = screenToLngLatMercator(lastBoundsRef.current, rect.width, rect.height, x, y);

    const kind = (e.dataTransfer.getData("text/sportlink-kind") as "EVENT" | "TRAINING") || dragPreview?.kind;
    if (!kind) return;

    setDragPreview({ kind, coords });
  }, [dragPreview?.kind]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("text/sportlink-kind") as "EVENT" | "TRAINING";
    if (!kind || !containerRef.current || !lastBoundsRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = screenToLngLatMercator(lastBoundsRef.current, rect.width, rect.height, x, y) as LngLat;

    setDragPreview(null);
    setCtxMenu(null);
    setSelected(null);

    if (!isAuthed) { navigate("/auth/login"); return; }
    setCreateState({ kind, coords });
  }, [isAuthed, navigate]);

  // контекстное меню мышью
  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current || !lastBoundsRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const coords = screenToLngLatMercator(lastBoundsRef.current, rect.width, rect.height, x, y);

    setCtxMenu({ coords, screenX: x, screenY: y });
    setSelected(null);
  };

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
      onContextMenu={handleContainerContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <GeoStatusOverlay pending={geoPending} error={geoError} />

      {/* ПАНЕЛЬ ПЕРЕТАСКИВАНИЯ */}
      <div className="absolute left-3 top-3 z-30 flex flex-col gap-2">
        <button
          draggable
          onDragStart={(e) => handleDragStart(e, "EVENT")}
          className="rounded-xl bg-amber-400/95 px-3 py-1 text-sm font-semibold shadow hover:bg-amber-400 transition"
          title="Перетащи на карту, чтобы создать событие"
        >
          ⬤ Создать событие (drag)
        </button>
        <button
          draggable
          onDragStart={(e) => handleDragStart(e, "TRAINING")}
          className="rounded-xl bg-blue-500/95 px-3 py-1 text-sm font-semibold text-white shadow hover:bg-blue-500 transition"
          title="Перетащи на карту, чтобы создать тренировку"
        >
          ⬤ Создать тренировку (drag)
        </button>

        <button
          onClick={recenterToMe}
          className="mt-2 rounded-full bg-white/95 px-3 py-1 text-sm shadow transition hover:bg-white"
        >
          Моё место
        </button>
      </div>

      {/* Контекстное меню (ПКМ) */}
      {ctxMenu && (
        <div
          className="absolute z-50 bg-white rounded-lg shadow-lg p-2 min-w-[180px]"
          style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setCreateState({ kind: "EVENT", coords: ctxMenu.coords })}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md"
            >
              Создать событие здесь
            </button>
            <button
              onClick={() => setCreateState({ kind: "TRAINING", coords: ctxMenu.coords })}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md"
            >
              Создать тренировку здесь
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
          onUpdate={(e: any) => {
            const loc = e?.location;
            onMapUpdate(loc);
            const b = loc?.bounds as YBounds | undefined;
            if (b) {
              lastBoundsRef.current = b;
              handleBounds(b);
            }
          }}
          onClick={() => { setSelected(null); setCtxMenu(null); }}
        />

        {/* Я */}
        {myPos && (
          <YMapMarker coordinates={myPos} zIndex={1000}>
            <div className="sl-pin sl-pin--user" title="Вы здесь" />
          </YMapMarker>
        )}

        {/* Превью во время перетаскивания */}
        {dragPreview && (
          <YMapMarker coordinates={dragPreview.coords} zIndex={999}>
            <div
              className={dragPreview.kind === "TRAINING" ? "sl-pin sl-pin--train ghost" : "sl-pin sl-pin--event ghost"}
              title="Место создания"
            />
          </YMapMarker>
        )}

        {/* Маркеры из стора */}
        {markers.map((e) => {
          const coords: LngLat = [e.locationLon as number, e.locationLat as number];
          const isTraining = (e.kind || "EVENT").toUpperCase() === "TRAINING";

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
            try { useEventStore.getState().add?.(created); } catch {}
            if (lastBoundsRef.current) handleBounds(lastBoundsRef.current);
            setCreateState(null);
          }}
        />
      )}
    </div>
  );
}
