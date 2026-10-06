import type { Mapbox } from "@/types/map";

let mapbox: Promise<Mapbox> | null = null;

/** Mapbox GL, loaded once however many maps ask (the page's, the Territorio's); rejects without WebGL */
export function loadMapbox(): Promise<Mapbox> {
  mapbox ??= import("mapbox-gl").then(({ default: gl }) => {
    if (!gl.supported?.()) throw new Error("WebGL unavailable");
    return gl;
  });
  return mapbox;
}
