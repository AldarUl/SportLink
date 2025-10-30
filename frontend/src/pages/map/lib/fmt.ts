import type { LngLat } from "./geo";

export function formatDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

export function openRouteExternal(from?: LngLat, to?: LngLat) {
  if (!to) return;
  const rtext = from ? `${from[1]},${from[0]}~${to[1]},${to[0]}` : `~${to[1]},${to[0]}`;
  window.open(`https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`, "_blank");
}
