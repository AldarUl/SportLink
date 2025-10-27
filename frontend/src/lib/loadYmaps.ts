import type * as ymapsNS from "yandex-maps";

declare global {
  interface Window {
    ymaps?: typeof ymapsNS;
  }
}

/**
 * Загружает Yandex Maps JS API и резолвит, когда он готов.
 * Возвращает Promise<void>, а сам API бери из window.ymaps.
 */
export function loadYmaps(
  apiKey: string,
  lang: "ru_RU" | "en_US" = "ru_RU"
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(() => resolve());
      return;
    }

    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=${lang}`;
    s.async = true;
    s.onload = () => window.ymaps?.ready(() => resolve());
    s.onerror = () => reject(new Error("Failed to load Yandex Maps API"));
    document.head.appendChild(s);
  });
}
