// Helpers to convert screen coordinates to lng/lat using Yandex Maps bounds (Web Mercator).

export type YBounds = [[number, number], [number, number]]; // [[lon, lat], [lon, lat]]

function normBounds(b: YBounds) {
  const [[lon1, lat1], [lon2, lat2]] = b;
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  return { minLon, maxLon, minLat, maxLat };
}

const lat2merc = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI / 180) / 2));
const merc2lat = (m: number) => (Math.atan(Math.sinh(m)) * 180) / Math.PI;

export function screenToLngLatMercator(
  bounds: YBounds,
  containerW: number,
  containerH: number,
  x: number,
  y: number
): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = normBounds(bounds);
  const tX = Math.min(Math.max(x / containerW, 0), 1);
  const tY = Math.min(Math.max(y / containerH, 0), 1);
  const lon = minLon + (maxLon - minLon) * tX;
  const mercMin = lat2merc(minLat);
  const mercMax = lat2merc(maxLat);
  const mercY = mercMax - (mercMax - mercMin) * tY;
  const lat = merc2lat(mercY);
  return [lon, lat];
}
