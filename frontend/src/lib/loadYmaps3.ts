// src/lib/loadYmaps3.ts
declare global { interface Window { ymaps3?: any } }

export async function loadYmaps3(
  apiKey: string,
  lang: "ru_RU" | "en_US" = "ru_RU"
): Promise<void> {
  const url = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=${lang}`;

  // Если уже загружено — просто ждём готовности
  if (window.ymaps3) {
    await window.ymaps3.ready;
    return;
  }
  if (!apiKey || apiKey === "undefined") {
    throw new Error("YMaps v3: apiKey is empty/undefined");
  }

  // Если скрипт уже вставлен (из другого места/горячая перезагрузка) — не дублируем
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src^="https://api-maps.yandex.ru/v3/"]'
  );
  if (existing) {
    await new Promise<void>((res, rej) => {
      if ((existing as any).dataset._ymaps3_loaded === "1") return res();
      existing.addEventListener("load", () => res(), { once: true });
      existing.addEventListener("error", () => rej(new Error("YMaps v3 script error")), { once: true });
    });
    await window.ymaps3?.ready;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://api-maps.yandex.ru";
    document.head.appendChild(pre);

    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      (s as any).dataset._ymaps3_loaded = "1";
      resolve();
    };
    s.onerror = (e) => {
      console.error("YMaps v3 load error. URL:", url, "event:", e);
      reject(new Error("Failed to load Yandex Maps API v3"));
    };
    document.head.appendChild(s);
  });

  await window.ymaps3.ready;

  window.ymaps3.import.registerCdn(
    "https://cdn.jsdelivr.net/npm/{package}",
    "@yandex/ymaps3-default-ui-theme@0.0"
  );
}
