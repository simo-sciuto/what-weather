"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { useMap } from "./MapContext";

/**
 * Mapbox Standard in its monochrome theme, always at night: a dark grey map
 * that keeps to the background, on which the white clouds and the blue rain
 * of the overlay stand out. On a light map the clouds would vanish.
 */
const STYLE = "mapbox://styles/mapbox/standard";
const BASEMAP = { theme: "monochrome", lightPreset: "night" };
const ZOOM = 8;

/** A canvas laid over the map (the animated clouds), and where its corners go: [lon, lat], clockwise from top left. */
export interface MapOverlay {
  canvas: HTMLCanvasElement;
  corners: [[number, number], [number, number], [number, number], [number, number]];
}

/**
 * The region on Mapbox, with `overlay` (the clouds and rain of the moment on
 * show) over it and a dot for the place. It can be dragged and zoomed; on a phone that
 * takes two fingers and on a computer Ctrl (⌘) with the wheel, so the page
 * still scrolls past it. Mapbox GL is large, so it loads only when the map
 * comes into view. Without WebGL (or a token) a short note stands in its place.
 */
export function StylizedMap({ overlay }: { overlay?: MapOverlay | null }) {
  const { center, token, loadMapbox } = useMap();
  const { lat, lon, name } = center;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import("mapbox-gl").Map | null>(null);
  const [failed, setFailed] = useState(!token);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || !token) return;
    let cancelled = false;

    const start = async () => {
      try {
        const mapboxgl = await loadMapbox();
        if (cancelled) return;
        const m = new mapboxgl.Map({
          container: el,
          accessToken: token,
          style: STYLE,
          config: { basemap: BASEMAP },
          center: [lon, lat],
          zoom: ZOOM,
          minZoom: 4,
          maxZoom: 13,
          language: "it",
          cooperativeGestures: true,
          // North stays up and the view flat, so the cloud overlay (a flat rectangle) stays aligned.
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          locale: {
            "ScrollZoomBlocker.CtrlMessage": "Usa Ctrl + rotellina per zoomare la mappa",
            "ScrollZoomBlocker.CmdMessage": "Usa ⌘ + rotellina per zoomare la mappa",
            "TouchPanBlocker.Message": "Usa due dita per spostare la mappa",
          },
        });
        map.current = m;

        m.on("style.load", () => setReady(true));

        const dot = document.createElement("span");
        dot.className = "block size-3.5 rounded-full bg-[var(--sun)] shadow-[0_0_16px_var(--sun)] ring-2 ring-white";
        dot.setAttribute("aria-hidden", "true");
        new mapboxgl.Marker({ element: dot }).setLngLat([lon, lat]).addTo(m);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    // Load the library only once the map is about to be seen.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        void start();
      },
      { rootMargin: "300px" },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, [lat, lon, token, loadMapbox]);

  // The overlay sits over the map as a page element, not inside it: Mapbox's night light and monochrome
  // theme would grade it along with the land, and the clouds must keep their own bright colours.
  // It follows the map: on every frame of a move or zoom, its corners go where their coordinates are.
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = map.current;
    const host = layer.current;
    if (!m || !ready || !overlay || !host) return;
    const { canvas, corners } = overlay;
    host.style.width = `${canvas.width}px`;
    host.style.height = `${canvas.height}px`;
    host.replaceChildren(canvas);
    const place = () => {
      const nw = m.project(corners[0]);
      const se = m.project(corners[2]);
      host.style.transform = `translate(${nw.x}px, ${nw.y}px) scale(${(se.x - nw.x) / canvas.width}, ${(se.y - nw.y) / canvas.height})`;
    };
    place();
    m.on("move", place);
    m.on("resize", place);
    return () => {
      m.off("move", place);
      m.off("resize", place);
      host.replaceChildren();
    };
  }, [ready, overlay]);

  if (failed) {
    return (
      <p className="flex h-72 items-center justify-center rounded-3xl border border-white/10 px-6 text-center text-sm text-ink-muted">
        La mappa non è disponibile su questo dispositivo.
      </p>
    );
  }
  return (
    <div className="relative h-72 overflow-hidden rounded-3xl border border-white/10 bg-[#0d0b24]">
      <div
        role="region"
        aria-label={`Mappa intorno a ${name}, con le nuvole e le precipitazioni previste`}
        className="absolute inset-0"
      >
        {/* Mapbox sets `position: relative` on its container, so it gets its own full-size box */}
        <div ref={box} className="h-full w-full" />
      </div>
      {/* Clouds and rain in soft, translucent tones (see CLOUD_PALETTE), so streets and names read through */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Sized to the canvas, then moved and scaled onto the map (see above) */}
        <div ref={layer} className="absolute left-0 top-0 origin-top-left [&>canvas]:block [&>canvas]:size-full" />
      </div>
      {!ready && <div aria-hidden="true" className="skeleton pointer-events-none absolute inset-0" />}
    </div>
  );
}
