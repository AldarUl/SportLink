// utils/route.ts
export function yandexRouteLink(from:{lat:number,lon:number}, to:{lat:number,lon:number}) {
  return `https://yandex.com/maps/?rtext=${from.lat},${from.lon}~${to.lat},${to.lon}&rtt=auto`;
}
