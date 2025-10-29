import React from "react";

export function GeoStatusOverlay({ pending, error }: { pending: boolean; error: string | null }) {
  return (
    <>
      {pending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-sm">
          <div className="animate-pulse text-sm text-gray-700">Определяем ваше местоположение…</div>
        </div>
      )}
      {!pending && error && (
        <div className="absolute top-3 left-3 z-20 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow">
          {error}
        </div>
      )}
    </>
  );
}
