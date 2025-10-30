import { useEffect, useState } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { loadYmaps3 } from "@/lib/loadYmaps3";

export function useYmaps() {
  const [apiReady, setApiReady] = useState(false);
  const [Y, setY] = useState<any>(null);

  useEffect(() => {
    (async () => {
      await loadYmaps3(import.meta.env.VITE_YANDEX_MAPS_API_KEY as string, "ru_RU");
      const ym3 = (window as any).ymaps3;
      const [ymaps3React] = await Promise.all([ym3.import("@yandex/ymaps3-reactify"), ym3.ready]);
      const reactify = ymaps3React.reactify.bindTo(React, ReactDOM);
      const base = reactify.module(ym3);
      setY(base);
      setApiReady(true);
    })();
  }, []);

  return { Y, apiReady };
}
