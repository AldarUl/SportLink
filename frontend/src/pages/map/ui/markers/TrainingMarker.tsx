import React from "react";
import type { Event as AppEvent } from "@/entities/event/types";
import type { LngLat } from "../../lib/geo";
import { formatDateTime } from "../../lib/fmt";
import { PopupCard } from "../PopupCard";
import ApplyWithdrawButton from "../balloons/ApplyWithdrawButton";



export function TrainingMarker({
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
  const title = e.title;
  const subtitle = `Тренировка • ${e.sport ?? ""} • ${formatDateTime(e.startsAt)}`;
  const PIN = 34, TAIL = 9, HALO = 0;

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

  return (
    <YMapMarker coordinates={coords} zIndex={active ? 1500 : 900}>
      <div
        className={`sl-pin-wrap sl-wrap--training ${active ? "sl-wrap--active" : ""}`}
        style={wrapStyle}
        onClick={(ev: any) => { ev.stopPropagation(); onOpen(e, coords); }}
        title={title}
      >
        <div
          className={`sl-pin sl-pin--training ${active ? "sl-pin--active" : ""}`}
          style={pinStyle}
          onPointerDown={() => setPressedId(e.id)}
          onPointerUp={() => setPressedId(null)}
          onPointerCancel={() => setPressedId(null)}
          onPointerLeave={() => setPressedId(null)}
        >
          {active && <span className="sl-shine" />}
          <span className="sl-band" />
        </div>

        {!active && (
          <div className="sl-badge" onClick={(ev) => { ev.stopPropagation(); onOpen(e, coords); }}>
            <div className="sl-badge__title">{title}</div>
            <div className="sl-badge__sub">{subtitle}</div>
          </div>
        )}

        {active && (
          <div className="sl-popover" onClick={(ev) => ev.stopPropagation()}>
            <PopupCard
              e={e}
              myPos={myPos ?? null}
              coords={coords}
              hasApp={hasApp}
              onApply={onApply}
              onWithdraw={onWithdraw}
              onClose={onClose}
              onMore={onMore}
            />
          </div>
        )}
      </div>
    </YMapMarker>
  );
}
