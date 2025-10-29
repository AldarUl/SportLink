// src/pages/map/MapPage.tsx
import React, { useEffect, useMemo, useState } from "react";
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

  // закрывать попап при уходе ниже порога
  useEffect(() => {
    if (!selected) return;
    const isTraining = (selected.e.kind || "EVENT").toUpperCase() === "TRAINING";
    const needed = isTraining ? Z_TRAININGS_FETCH : Z_EVENTS_FETCH;
    if (zoom < needed) setSelected(null);
  }, [zoom, selected]);

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
      <GeoStatusOverlay pending={geoPending} error={geoError} />

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
            onMapUpdate(loc);
            if (loc?.zoom && loc.zoom >= Z_EVENTS_FETCH) {
              const b = loc?.bounds;
              if (b) handleBounds(b);
            } else {
              cancel();
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
            onApply: onApplySafe,               // <<< безопасные
            onWithdraw: onWithdrawSafe,         // <<< обработчики
            onMore: () => navigate(`/event/${e.id}`),
            myPos,
            onClose: () => setSelected(null),   // крестик закрывает попап
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
