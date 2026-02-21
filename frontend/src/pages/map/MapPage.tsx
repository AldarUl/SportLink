import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useEventStore } from "@/entities/event/store";
import type { Event as AppEvent } from "@/entities/event/types";
import { listMyOrganizedEvents } from "@/entities/event/api";
import { useAuthStore } from "@/features/auth/store";

import { useYmaps } from "./hooks/useYmaps";
import { useGeolocation } from "./hooks/useGeolocation";
import { useViewport } from "./hooks/useViewport";
import { useViewportFetch } from "./hooks/useViewportFetch";
import { useApplyWithOverlap } from "./hooks/useApplyWithOverlap";

import type { LngLat } from "./lib/geo";
import { screenToLngLatMercator, type YBounds } from "./lib/mercator";

import { GeoStatusOverlay } from "./ui/overlays/GeoStatusOverlay";
import { EventMarker } from "./ui/markers/EventMarker";
import { TrainingMarker } from "./ui/markers/TrainingMarker";
import { CreateEventModal } from "./ui/modals/CreateEventModal";
import { DragDock } from "./ui/dock/DragDock";
import { MyTrainingsPanel } from "./panels/MyTrainingsPanel";
import { OrganizerPanel } from "./panels/OrganizerPanel";

import { SPORTS_FALLBACK, normalizeSportCode } from "@/shared/lib/sport";

import "./styles/mapPins.css";

type ContextMenuState = {
  coords: [number, number];
  screenX: number;
  screenY: number;
} | null;

type DragPreview = { kind: "EVENT" | "TRAINING"; coords: LngLat } | null;

function uniqById(items: AppEvent[]) {
  const map = new Map<string, AppEvent>();
  for (const e of items) {
    if (!e?.id) continue;
    map.set(String(e.id).toLowerCase(), e);
  }
  return Array.from(map.values());
}

function endsAtMs(e: AppEvent) {
  const base = Date.parse((e as any).launchedAt || e.startsAt);
  const dur = Number(e.durationMin || 0);
  return base + dur * 60 * 1000;
}

function visibleOnMap(e: AppEvent, nowMs: number) {
  const status = String((e as any).status || "").toUpperCase();
  if (status === "CANCELLED" || status === "FINISHED") return false;
  // если по времени уже закончилось — скрываем, даже если статус ещё не обновился
  if (Number.isFinite(endsAtMs(e)) && nowMs > endsAtMs(e)) return false;
  return true;
}

function passesLevelRangeFilter(e: AppEvent, levelFrom: number | "", levelTo: number | "") {
  if (levelFrom === "" && levelTo === "") return true;

  const from = levelFrom === "" ? 1 : Number(levelFrom);
  const to = levelTo === "" ? 5 : Number(levelTo);

  const min = e.levelMin == null ? 1 : Number(e.levelMin);
  const max = e.levelMax == null ? 5 : Number(e.levelMax);

  // пересечение диапазонов (event range vs filter range)
  return max >= from && min <= to;
}

export default function MapPage() {
  const navigate = useNavigate();
  const events = useEventStore((s) => s.events);
  const { Y, apiReady } = useYmaps();

  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const me = useAuthStore((s) => s.user);

  const { myPos, geoPending, geoError, location, setLocation, recenterToMe } = useGeolocation(apiReady);
  const { zoomRef, onMapUpdate } = useViewport();
  const { handleBounds } = useViewportFetch(zoomRef, () => Infinity);

  const { mine, loadMine, handleApply, withdrawByEvent, findByEventId } = useApplyWithOverlap();
  useEffect(() => {
    if (isAuthed) loadMine();
  }, [isAuthed, loadMine]);

  const [myOrganizedEvents, setMyOrganizedEvents] = useState<AppEvent[]>([]);
  useEffect(() => {
    let dead = false;
    if (!isAuthed) {
      setMyOrganizedEvents([]);
      return;
    }
    (async () => {
      try {
        const list = await listMyOrganizedEvents({ futureOnly: false, page: 0, size: 200 });
        if (!dead) setMyOrganizedEvents(list as any);
      } catch (e) {
        console.warn("[MapPage] listMyOrganizedEvents failed:", e);
      }
    })();
    return () => {
      dead = true;
    };
  }, [isAuthed]);

  const refreshMyOrganized = useCallback(async () => {
    if (!isAuthed) return;
    const list = await listMyOrganizedEvents({ futureOnly: false, page: 0, size: 200 });
    setMyOrganizedEvents(list as any);
  }, [isAuthed]);

  const [selected, setSelected] = useState<{ e: AppEvent; coords: LngLat } | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);

  // client-side filters for map markers
  const [sportFilter, setSportFilter] = useState<string>("");
  const [levelFromFilter, setLevelFromFilter] = useState<number | "">("");
  const [levelToFilter, setLevelToFilter] = useState<number | "">("");

  const lastBoundsRef = useRef<YBounds | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview>(null);
  const [createState, setCreateState] = useState<{ kind: "EVENT" | "TRAINING"; coords: LngLat } | null>(null);

  const onApplySafe = async (ev: AppEvent) => {
    if (!isAuthed) {
      navigate("/auth/login");
      return;
    }
    await handleApply(ev);
  };
  const onWithdrawSafe = async (id: string) => {
    if (!isAuthed) {
      navigate("/auth/login");
      return;
    }
    await withdrawByEvent(id);
  };

  const focusOnEvent = useCallback(
    (ev: AppEvent) => {
      const lat = ev.locationLat;
      const lon = ev.locationLon;
      if (lat == null || lon == null) return;
      const center: LngLat = [Number(lon), Number(lat)];
      const zoom = Math.max(zoomRef.current || 12, 15);
      setLocation({ center, zoom });
      setSelected({ e: ev, coords: center });
      try {
        mapRef.current?.setLocation?.({ center, zoom, duration: 250 });
      } catch {}
    },
    [setLocation, zoomRef]
  );

  // закрытие контекстного меню
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") setCtxMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true } as any);
      window.removeEventListener("keydown", handleKeyDown, { capture: true } as any);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [ctxMenu]);

  const nowMs = Date.now();

  const appliedEvents = useMemo(() => {
    return (mine || []).map((a: any) => a?.event).filter(Boolean) as AppEvent[];
  }, [mine]);

  const allEvents = useMemo(() => {
    return uniqById([...(events as AppEvent[]), ...appliedEvents, ...(myOrganizedEvents as AppEvent[])]);
  }, [events, appliedEvents, myOrganizedEvents]);

  useEffect(() => {
    if (!selected) return;
    const id = String(selected.e.id).toLowerCase();
    const ev = (allEvents as AppEvent[]).find((x) => String(x.id).toLowerCase() === id);
    if (!ev) {
      setSelected(null);
      return;
    }

    // если не проходит фильтры — закрываем попап
    if (sportFilter && normalizeSportCode(ev.sport) !== sportFilter) {
      setSelected(null);
      return;
    }
    if (!passesLevelRangeFilter(ev, levelFromFilter, levelToFilter)) {
      setSelected(null);
      return;
    }
  }, [allEvents, selected, sportFilter, levelFromFilter, levelToFilter]);

  const markers = useMemo(() => {
    const base = (allEvents as AppEvent[])
      .filter((e) => e.locationLat != null && e.locationLon != null)
      .filter((e) => visibleOnMap(e, nowMs));

    return base.filter((e) => {
      if (sportFilter && normalizeSportCode(e.sport) !== sportFilter) return false;
      if (!passesLevelRangeFilter(e, levelFromFilter, levelToFilter)) return false;
      return true;
    });
  }, [allEvents, nowMs, sportFilter, levelFromFilter, levelToFilter]);

  const myOrganized = useMemo(() => {
    const myId = me?.id;
    if (!myId) return [] as AppEvent[];
    return uniqById((myOrganizedEvents as AppEvent[]).filter((e: any) => String(e.organizerId) === String(myId)));
  }, [myOrganizedEvents, me?.id]);

  const setNiceDragImage = (e: React.DragEvent, label = "•") => {
    const ghost = document.createElement("div");
    ghost.style.cssText =
      "width:24px;height:24px;border-radius:999px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;font:600 14px sans-serif";
    ghost.innerText = label;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragStart = (e: React.DragEvent, kind: "EVENT" | "TRAINING") => {
    e.dataTransfer.setData("text/sportlink-kind", kind);
    e.dataTransfer.effectAllowed = "copy";
    setNiceDragImage(e, kind === "EVENT" ? "E" : "T");
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
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
    },
    [dragPreview?.kind]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
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
      if (!isAuthed) {
        navigate("/auth/login");
        return;
      }
      setCreateState({ kind, coords });
    },
    [isAuthed, navigate]
  );

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
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapListener } = Y;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      onContextMenu={handleContainerContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <GeoStatusOverlay pending={geoPending} error={geoError} />

      {/* LEFT: участник */}
      <MyTrainingsPanel
        mine={mine as any}
        myPos={myPos}
        onWithdraw={onWithdrawSafe}
        onShowLocation={(ev) => focusOnEvent(ev)}
      />

      {/* RIGHT: организатор */}

      <OrganizerPanel myEvents={myOrganized} onShowLocation={(ev) => focusOnEvent(ev)} />

      {/* BOTTOM: Dock */}
      <DragDock
        onDragStart={handleDragStart}
        onRecenter={recenterToMe}
        sports={SPORTS_FALLBACK}
        sportFilter={sportFilter}
        levelFrom={levelFromFilter}
        levelTo={levelToFilter}
        onSportFilterChange={setSportFilter}
        onLevelFromChange={setLevelFromFilter}
        onLevelToChange={setLevelToFilter}
      />

      {/* Контекстное меню (ПКМ) */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="absolute z-50 bg-white rounded-lg shadow-lg p-2 min-w-[180px]"
          style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                setCreateState({ kind: "EVENT", coords: ctxMenu.coords });
                setCtxMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md"
            >
              Создать событие здесь
            </button>
            <button
              onClick={() => {
                setCreateState({ kind: "TRAINING", coords: ctxMenu.coords });
                setCtxMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md"
            >
              Создать тренировку здесь
            </button>
          </div>
        </div>
      )}

      <YMap ref={mapRef} location={location} className="w-full h-full" showScaleInCopyrights>
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
          onClick={() => {
            setSelected(null);
            setCtxMenu(null);
          }}
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

        {/* Маркеры */}
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

          return isTraining ? (
            <TrainingMarker key={String(e.id).toLowerCase()} {...(commonProps as any)} />
          ) : (
            <EventMarker key={String(e.id).toLowerCase()} {...(commonProps as any)} />
          );
        })}
      </YMap>

      {/* Модалка создания */}
      {createState && (
        <CreateEventModal
          open
          kind={createState.kind}
          coords={createState.coords}
          onClose={() => setCreateState(null)}
          onCreated={async (created) => {
            try {
              useEventStore.getState().add?.(created);
            } catch {}
            if (lastBoundsRef.current) handleBounds(lastBoundsRef.current);

            // подтянуть списки
            try {
              await loadMine();
            } catch {}
            try {
              await refreshMyOrganized();
            } catch {}

            setCreateState(null);
          }}
        />
      )}
    </div>
  );
}
