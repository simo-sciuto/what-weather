"use client";

import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import type { MapLayer } from "@/lib/weather/palette";
import { useMoment } from "../time/TimeContext";
import { useMap } from "./MapContext";


type Pin = { x: number; y: number };

/**
 * Where the city goes on the screen: at the exact centre of the reading, the
 * poster (marked data-map-anchor). Measured, not guessed, so it holds for any
 * window size and any name's length.
 */
function measurePin(): Pin | null {
  const poster = document.querySelector('[data-map-anchor="poster"]')?.getBoundingClientRect();
  if (!poster) return null;
  return { x: (poster.left + poster.right) / 2, y: (poster.top + poster.bottom) / 2 };
}

/** Padding that moves the map's centre (the city) onto the pin. */
function paddingFor({ x, y }: Pin, w: number, h: number) {
  return {
    left: Math.max(0, 2 * x - w),
    right: Math.max(0, w - 2 * x),
    top: Math.max(0, 2 * y - h),
    bottom: Math.max(0, h - 2 * y),
  };
}
const ZOOM = 11;

/** Zoom levels added over the page's whole scroll: from the city down to its streets. */
const SCROLL_ZOOM = 2.5;

/** How far down the page is, 0 at the top to 1 at the bottom. */
function scrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
}

/** A road class filter on Mapbox Streets' `road` layer (lines only). */
const roads = (classes: string[]): FilterSpecification => [
  "all",
  ["==", ["geometry-type"], "LineString"],
  ["match", ["get", "class"], classes, true, false],
];
/** Line width that grows as the map zooms in. */
const width = (at10: number, at15: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  at10,
  15,
  at15,
];

/**
 * The map as a drawing: only the city's lines, and nothing else. No background layer, so the canvas is transparent
 * wherever there is no line and the sky shows through as it is: no blend
 * mode needed (a blended WebGL canvas isn't reliable across browsers), and
 * the colours are exactly as set. These are only the first ones: once drawn,
 * every layer takes the colours opposite the sky of the moment on show.
 */
const STYLE: StyleSpecification = {
  version: 8,
  sources: { streets: { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" } },
  layers: [
    {
      id: "water",
      type: "fill",
      source: "streets",
      "source-layer": "water",
      paint: { "fill-color": "#9ce0f7", "fill-opacity": 0.35 },
    },
    {
      id: "waterway",
      type: "line",
      source: "streets",
      "source-layer": "waterway",
      paint: { "line-color": "#9ce0f7", "line-width": width(0.8, 2.5), "line-opacity": 0.85 },
    },
    {
      id: "streets",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(["street", "street_limited", "tertiary", "tertiary_link", "secondary_link"]),
      paint: { "line-color": "#eebae8", "line-width": width(0.3, 1.6), "line-opacity": 0.7 },
    },
    {
      id: "main-roads",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(["secondary", "primary", "primary_link", "trunk", "trunk_link"]),
      paint: { "line-color": "#fec89c", "line-width": width(0.8, 3), "line-opacity": 0.9 },
    },
    {
      id: "motorways",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(["motorway", "motorway_link"]),
      paint: { "line-color": "#f9e8a7", "line-width": width(1.2, 4), "line-opacity": 0.95 },
    },
  ],
};

/** Whether each layer is a fill or a line: its colour and opacity follow the sky (see mapInks in palette.ts) */
const KIND: Record<MapLayer, "fill" | "line"> = {
  water: "fill",
  waterway: "line",
  streets: "line",
  "main-roads": "line",
  motorways: "line",
};

/**
 * The city behind the top of the page, drawn by Mapbox on the sky as it is.
 * This renders the whole band (the caller gives its position, size, fade and
 * opacity). Mapbox GL loads once the browser is idle and the band is near the
 * screen, and fades in, with the city beside its name. Without a token or
 * WebGL there is no map: the sky alone is the backdrop.
 */
export function MapBackdropGL({ className }: { className: string }) {
  const { center, token, loadMapbox } = useMap();
  const { lat, lon } = center;
  const inks = useMoment().look.palette.map;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const [failed, setFailed] = useState(!token);
  const [shown, setShown] = useState(false);
  const [pin, setPin] = useState<Pin | null>(null);
  const pinRef = useRef<Pin | null>(null);
  const zoomRef = useRef(ZOOM);

  // Measure the pin now and whenever the layout changes (the window, the name itself, the font arriving);
  // move the map to match.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const p = measurePin();
        if (!p) return;
        pinRef.current = p;
        setPin(p);
        const m = mapRef.current;
        const el = box.current;
        if (m && el) m.setPadding(paddingFor(p, el.clientWidth, el.clientHeight));
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    for (const anchor of document.querySelectorAll("[data-map-anchor]")) ro.observe(anchor);
    let live = true;
    void document.fonts?.ready.then(() => live && update());
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  // Scrolling down zooms into the city: the map stays fixed, so the page seems to descend into it.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const extra = SCROLL_ZOOM * scrollProgress();
        zoomRef.current = ZOOM + extra;
        mapRef.current?.setZoom(zoomRef.current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || !token) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    let idle: number | undefined;

    const start = async () => {
      try {
        const mapboxgl = await loadMapbox();
        if (cancelled) return;
        const { width: w, height: h } = el.getBoundingClientRect();
        map = new mapboxgl.Map({
          container: el,
          accessToken: token,
          style: STYLE,
          center: [lon, lat],
          zoom: zoomRef.current,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        // Shift the view so the city lands on the pin rather than the middle.
        map.setPadding(paddingFor(pinRef.current ?? measurePin() ?? { x: w / 2, y: h / 2 }, w, h));
        let drawn = false;
        map.once("idle", () => {
          drawn = true;
          if (!cancelled) setShown(true);
        });
        // A style that fails to load falls back; a stray tile error once it's drawn doesn't.
        map.on("error", () => {
          if (!cancelled && !drawn) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    // Near the screen, then when the browser has a moment: the page first, the backdrop after.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const run = () => void start();
        idle =
          typeof window.requestIdleCallback === "function"
            ? window.requestIdleCallback(run, { timeout: 2000 })
            : (setTimeout(run, 300) as unknown as number);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      if (idle != null) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
        else clearTimeout(idle);
      }
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lon, token, loadMapbox]);

  // The sky's opposite colours, as the moment on show changes
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !shown) return;
    for (const layer of Object.keys(KIND) as MapLayer[]) {
      const kind = KIND[layer];
      m.setPaintProperty(layer, `${kind}-color` as "line-color", inks[layer].color);
      m.setPaintProperty(layer, `${kind}-opacity` as "line-opacity", inks[layer].opacity);
    }
  }, [inks, shown]);

  // The map is strongest around the pin; once it's measured, the fade follows it.
  const fade = pin
    ? `radial-gradient(ellipse 45vw 50vh at ${pin.x}px ${pin.y}px, #000 15%, rgb(0 0 0 / 0.65) 80%)`
    : undefined;

  if (failed) return null;
  return (
    <div
      className={className}
      style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-1000 ${shown ? "opacity-100" : "opacity-0"}`}
      >
        {/* Mapbox sets `position: relative` on its container, so it gets its own full-size box */}
        <div ref={box} className="h-full w-full" />
      </div>
    </div>
  );
}
