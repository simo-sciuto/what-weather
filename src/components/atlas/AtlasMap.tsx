"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { ATLAS_PADDING, ATLAS_START } from "@/constants/atlas";
import { parsePlaceRef } from "@/lib/place";
import { createMapboxCameraPort, type MapboxCameraPort } from "@/lib/atlas/mapbox-camera-port";
import { sunPosition } from "@/lib/weather/sun-position";
import type { CameraEvent, PointSky } from "@/types/atlas";
import type { Mapbox } from "@/types/map";
import type { Map as MapboxMap, StyleSpecification } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { STYLE, syncMap } from "@/lib/map/map-style";
import type { SunAt } from "./SkyDriver";
import type { MapOption } from "@/lib/map-options";
import { peakOf, type Selection } from "@/lib/atlas/selection";
import { useAtlasMapLook } from "./atlas-look";
import { ATLAS_TEST_MAP, countRender } from "./atlas-test";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** The map of a build made for the tests: nothing to draw, no service to ask (see atlas-test.ts) */
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  // A source with an attribution and a layer that uses it, so the attribution control has something to show, as it
  // does over Mapbox's own data
  sources: { test: { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "© Mapbox, test map" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#27406b" } },
    { id: "test-lines", type: "line", source: "test" },
  ],
};

let mapbox: Promise<Mapbox> | null = null;
/** Mapbox GL, loaded once; rejects without WebGL */
function loadMapbox(): Promise<Mapbox> {
  mapbox ??= import("mapbox-gl").then(({ default: gl }) => {
    if (!gl.supported?.()) throw new Error("WebGL unavailable");
    return gl;
  });
  return mapbox;
}

/** How many maps this page has made: more than one is a map made again, which the Atlas never does */
let creations = 0;

type Probe = { map?: MapboxMap; port?: MapboxCameraPort; events?: CameraEvent[] };

/**
 * The Atlas's one map (ADR-020, M3). It is made once, when the shell is first shown, and lives as long as the shell: the
 * effect has no dependency that a navigation, a place or the weather can change, so the content of the route comes and
 * goes round it. The camera is the map's own: free for the hands (drag, wheel, pinch, rotation, tilt, the keyboard), and
 * moved by the code only through the camera port. Nothing here renders for a frame of a movement, and nothing here asks
 * for any weather. The drawing is the home page's own (`STYLE`, `syncMap`, the viewer's layers and tuning), over the sky
 * of the shell; Mapbox's attribution and logo stay where its control puts them.
 */
export function AtlasMap({
  onPort,
  onMap,
  sky,
  sunAt = null,
  options: layerOptions,
  onPeak,
}: {
  onPort: (port: MapboxCameraPort | null) => void;
  onMap?: (map: MapboxMap | null) => void;
  sky: PointSky;
  /** Where and when the relief is lit: the point and hour on show; with none, Torino now */
  sunAt?: SunAt | null;
  /** The options of the layer on show, when it is not Meteo (WTH-346) */
  options?: readonly MapOption[];
  /** A summit was tapped (WTH-351): its name, height and point from the map's own label */
  onPeak?: (peak: Selection) => void;
}) {
  countRender("map");
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const portRef = useRef(onPort);
  const mapCb = useRef(onMap);
  const [state, setState] = useState<"loading" | "ready" | "none" | "failed">(TOKEN || ATLAS_TEST_MAP ? "loading" : "none");
  const { inks, options } = useAtlasMapLook(sky, layerOptions);

  const peakCb = useRef(onPeak);
  useEffect(() => {
    portRef.current = onPort;
    mapCb.current = onMap;
    peakCb.current = onPeak;
  });

  useEffect(() => {
    const el = box.current;
    if (!el || (!TOKEN && !ATLAS_TEST_MAP)) return;
    let cancelled = false;
    let map: MapboxMap | undefined;
    let port: MapboxCameraPort | undefined;

    (async () => {
      try {
        const gl = await loadMapbox();
        if (cancelled) return;
        // An address that names a point opens the map on it, so the point on show is the one under the crosshair
        const named = parsePlaceRef(Object.fromEntries(new URLSearchParams(window.location.search)));
        const opening = named ? { lng: named.lon, lat: named.lat } : ATLAS_START;
        map = new gl.Map({
          container: el,
          accessToken: TOKEN || "pk.atlas-test-map-no-service",
          style: TOKEN ? STYLE : BLANK_STYLE,
          center: [opening.lng, opening.lat],
          zoom: ATLAS_START.zoom,
          pitch: ATLAS_START.pitch,
          bearing: ATLAS_START.bearing,
          // Free: drag, wheel, pinch, rotation, tilt and the keyboard are all Mapbox's own and on; the attribution
          // control and the logo are on too, as Mapbox requires. No limit is set beyond the engine's.
          interactive: true,
          attributionControl: true,
          fadeDuration: 0,
        });
        mapRef.current = map;
        creations += 1;
        el.dataset.mapCreations = String(creations);
        el.dataset.mapInstance = String(creations);
        map.getCanvas().setAttribute("aria-label", "Mappa libera. Trascina per spostarti, rotella o più e meno per lo zoom.");

        port = createMapboxCameraPort(map);
        const { top, right, bottom, left } = ATLAS_PADDING;
        if (top || right || bottom || left) port.setPadding(ATLAS_PADDING);

        // A tap on a summit opens its card; the pointer says it can be tapped
        map.on("click", "peaks", (e) => {
          const f = e.features?.[0] as { geometry?: { type: string; coordinates?: unknown }; properties?: Record<string, unknown> | null } | undefined;
          const coords = f?.geometry?.type === "Point" ? (f.geometry.coordinates as [number, number]) : [e.lngLat.lng, e.lngLat.lat];
          const peak = peakOf(f?.properties, coords[0], coords[1]);
          if (peak) peakCb.current?.(peak);
        });
        map.on("mouseenter", "peaks", () => (map!.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "peaks", () => (map!.getCanvas().style.cursor = ""));

        if (ATLAS_TEST_MAP) {
          // The blank test map has no tiles and so no summits: the tests tap one through here
          (window as unknown as { __atlasPeak?: (p: Record<string, unknown>, lng: number, lat: number) => void }).__atlasPeak = (p, lng, lat) => {
            const peak = peakOf(p, lng, lat);
            if (peak) peakCb.current?.(peak);
          };
          const probe = window as unknown as { __atlas?: Probe };
          const events: CameraEvent[] = [];
          port.subscribe((e) => events.push(e));
          probe.__atlas = { map, port, events };
        }

        portRef.current(port);
        map.once("idle", () => {
          if (cancelled) return;
          setState("ready");
          // The style is drawn: what is laid under its lines (the weather field) can be added
          mapCb.current?.(map ?? null);
        });
        // A style that fails to load falls back; a stray tile error once it is drawn does not
        map.on("error", () => {
          if (!cancelled && !map?.loaded()) setState("failed");
        });
      } catch {
        if (!cancelled) setState("failed");
      }
    })();

    return () => {
      cancelled = true;
      port?.dispose();
      map?.remove();
      mapRef.current = null;
      portRef.current(null);
      mapCb.current?.(null);
      if (ATLAS_TEST_MAP) delete (window as unknown as { __atlas?: Probe }).__atlas;
    };
  }, []);

  // The colours of the home page's map, once the style is drawn and again when the viewer retunes them
  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== "ready" || ATLAS_TEST_MAP) return;
    const at = sunAt ?? { time: Date.now() / 1000, lat: ATLAS_START.lat, lon: ATLAS_START.lng };
    const sun = sunPosition(at.time, at.lat, at.lon);
    syncMap(map, { inks, options, sun, lat: at.lat });
  }, [inks, options, state, sunAt]);

  return (
    <>
      {/* Mapbox's own stylesheet makes the container it is given `position: relative`, so it gets a box of its own to fill */}
      {/* The browser's own focus ring is near black, lost on the map: the page's ring (accent), inset since the map fills the screen */}
      <div className="absolute inset-0 touch-none overscroll-none [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-accent [&_canvas:focus-visible]:outline-2 [&_canvas:focus-visible]:-outline-offset-2 [&_canvas:focus-visible]:outline-accent">
        <div ref={box} data-atlas-map data-state={state} role="application" aria-label="Mappa libera" className="h-full w-full" />
      </div>
      {state === "none" && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-caption text-ink-muted">
          La mappa si disegna con Mapbox e qui manca il token.
        </p>
      )}
      {state === "failed" && (
        <p role="status" className="absolute inset-0 grid place-items-center px-6 text-center text-caption text-ink-muted">
          La mappa non si può disegnare su questo dispositivo.
        </p>
      )}
    </>
  );
}
