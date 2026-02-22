import React from "react";
import type { Event as AppEvent } from "@/entities/event/types";
import type { LngLat } from "../../lib/geo";
import { formatDateTime } from "../../lib/fmt";
import { sportLabel } from "@/shared/lib/sport";
import { PopupCard } from "../PopupCard";



export function EventMarker({
  YMapMarker,
  e,
  coords,
  active,
  hasApp,
  pressedId,
  setPressedId,
  onOpen,
  onApply,
  onWithdraw,
  onMore,
  myPos,
  onClose,
}: {
  YMapMarker: any;
  e: AppEvent;
  coords: LngLat;
  active: boolean;
  hasApp: boolean;
  pressedId: string | null;
  setPressedId: (id: string | null) => void;
  onOpen: (e: AppEvent, coords: LngLat) => void;
  onApply: (e: AppEvent) => void;
  onWithdraw: (eventId: string) => void;
  onMore: () => void;
  myPos?: LngLat | null;
  onClose: () => void;
}) {
  const lvlMinRaw = (e as any).levelMin;
  const lvlMin = typeof lvlMinRaw === "number" && Number.isFinite(lvlMinRaw)
    ? Math.max(1, Math.min(5, Math.round(lvlMinRaw)))
    : null;

  const title = e.title;
  const subtitle = `Событие • ${sportLabel(e.sport) ?? ""} • ${formatDateTime(e.startsAt)}`;
  const PIN = 52, TAIL = 12, HALO = 12;

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
    left: `${HALO}px`, bottom: `${TAIL + HALO}px`, width: `${PIN}px`, height: `${PIN}px`,
  };

  return (
    <YMapMarker coordinates={coords} zIndex={active ? 1500 : 1100}>
      <div
        className={`sl-pin-wrap sl-wrap--event ${active ? "sl-wrap--active" : ""}`}
        style={wrapStyle}
        onClick={(ev: any) => { ev.stopPropagation(); onOpen(e, coords); }}
        title={title}
      >
        {/* аура + волны */}
        <span className={`sl-aura ${active ? "sl-aura--active" : ""}`} style={auraStyle} aria-hidden="true" />
        <div className="sl-ripples" aria-hidden="true"><span></span><span></span><span></span></div>

        {/* тело пина */}
        <div
          className={`sl-pin sl-pin--event ${active ? "sl-pin--active" : ""}`}
          style={pinStyle}
          onPointerDown={() => setPressedId(e.id)}
          onPointerUp={() => setPressedId(null)}
          onPointerCancel={() => setPressedId(null)}
          onPointerLeave={() => setPressedId(null)}
        >
          {active && <span className="sl-shine" />}
          <span className="sl-band" />
          {lvlMin && <span className="sl-lvl sl-lvl--event" aria-hidden="true">{lvlMin}</span>}
        </div>

        {/* мини-бейдж */}
        {!active && (
          <div
            className="sl-badge sl-badge--event"
            onClick={(ev) => { ev.stopPropagation(); onOpen(e, coords); }}
          >
            <div className="sl-badge__title">
              <span className="sl-chip sl-chip--event">СОБЫТИЕ</span>
              <span className="ml-1">{title}</span>
            </div>
            <div className="sl-badge__sub sl-badge__sub--event">{subtitle}</div>
          </div>
        )}

        {/* попап — ЯКОРЕН внутри маркера */}
        {active && (
          <div className="sl-popover" onClick={(ev) => ev.stopPropagation()}>
            <PopupCard
              e={e}
              myPos={myPos ?? null}
              coords={coords}
              onClose={onClose}
              onMore={onMore}
            />
          </div>
        )}
      </div>
    </YMapMarker>
  );
}
