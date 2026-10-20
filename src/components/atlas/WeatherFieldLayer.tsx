"use client";

import { FIELD_IMAGE, FIELD_OPACITY, FIELD_TINT_OPACITY, POINT_TIMEOUT_MS } from "@/constants/atlas";
import { createFieldLoader } from "@/lib/atlas/field-loader";
import { interpolateField, latticeBox } from "@/lib/atlas/field-image";
import type { Bounds, CameraPort, WeatherField } from "@/types/atlas";
import type { ImageSource, Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { fieldColorsAt } from "@/lib/atlas/field-hours";
import { ATLAS_TEST_MAP } from "./atlas-test";

const SOURCE = "atlas-weather-field";
const LAYER = "atlas-weather-field";
const TINT = "atlas-weather-tint";

const isField = (v: unknown): v is WeatherField => {
  const f = v as WeatherField | null;
  return (
    !!f &&
    Array.isArray(f.lats) &&
    Array.isArray(f.lons) &&
    Array.isArray(f.colors) &&
    f.colors.length === f.lats.length * f.lons.length &&
    f.colors.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) &&
    f.lats.length >= 2 &&
    f.lons.length >= 2 &&
    typeof f.provider === "string"
  );
};

async function fetchField(bounds: Bounds, signal: AbortSignal): Promise<WeatherField | null> {
  const query = new URLSearchParams({ west: String(bounds.west), south: String(bounds.south), east: String(bounds.east), north: String(bounds.north) });
  const response = await fetch(`/api/atlas/field?${query}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(POINT_TIMEOUT_MS)]) });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return isField(body) ? body : null;
}

/**
 * The weather of many places at once, as colour under and over the map's lines (WTH-272, ADR-026): a lattice of places over what
 * is in view, each place's weather a colour (its temperature's colour, greyed by cloud, darkened by rain, dimmed by its own night (`fieldColor`)), faded smoothly from
 * one to the next, so where Milano's weather is not Roma's the colours fade from one to the other. It is an image Mapbox
 * stretches over the lattice's box, once under every line of the map and once, lightly, over them all, drawn again when a stop needs other places. It draws
 * nothing itself and never renders for a frame: the camera is heard at `moveend` only. A line says what the colours are, a
 * model's reading interpolated between places, and how far apart the places are.
 */
export function WeatherFieldLayer({
  map,
  port,
  onColors,
  instant = null,
  opacity = FIELD_OPACITY,
  tint = FIELD_TINT_OPACITY,
}: {
  map: MapboxMap | null;
  port: CameraPort | null;
  /** The colours of the places in view, each time they are drawn: what the interface's surfaces are measured against */
  onColors?: (colors: readonly string[]) => void;
  /** The hour on show, Unix seconds; null for "Adesso". The field draws that hour's colours where it has them (WTH-345) */
  instant?: number | null;
  /** How strong the field is under the lines and over them: the layer on show quiets it (WTH-346) */
  opacity?: number;
  tint?: number;
}) {
  const [shown, setShown] = useState<WeatherField | null>(null);
  // The hour on show and a way to paint again without asking: moving the time bar redraws the image it already has
  const instantRef = useRef(instant);
  const fieldRef = useRef<WeatherField | null>(null);
  const paintRef = useRef<((field: WeatherField) => void) | null>(null);

  useEffect(() => {
    if (!map || !port) return;
    const canvas = document.createElement("canvas");
    canvas.width = FIELD_IMAGE.width;
    canvas.height = FIELD_IMAGE.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let draws = 0;

    const paint = (field: WeatherField) => {
      const { colors } = fieldColorsAt(field, instantRef.current);
      const pixels = interpolateField(field, colors, FIELD_IMAGE.width, FIELD_IMAGE.height);
      ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, FIELD_IMAGE.width, FIELD_IMAGE.height), 0, 0);
      const { west, east, south, north } = latticeBox(field);
      const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [[west, north], [east, north], [east, south], [west, south]];
      const url = canvas.toDataURL("image/png");
      const source = map.getSource(SOURCE) as ImageSource | undefined;
      if (source) source.updateImage({ url, coordinates });
      else {
        map.addSource(SOURCE, { type: "image", url, coordinates });
        // under every line of the map: the first layer of the style is the one it sits below
        const first = map.getStyle().layers?.[0]?.id;
        map.addLayer({ id: LAYER, type: "raster", source: SOURCE, paint: { "raster-opacity": FIELD_OPACITY, "raster-fade-duration": 0, "raster-resampling": "linear" } }, first);
        // and the same colours over every line and the water, so the whole map, not only what is behind it, is of its place's weather
        map.addLayer({ id: TINT, type: "raster", source: SOURCE, paint: { "raster-opacity": FIELD_TINT_OPACITY, "raster-fade-duration": 0, "raster-resampling": "linear" } });
      }
      onColors?.(colors);
    };
    paintRef.current = paint;

    const draw = (field: WeatherField) => {
      fieldRef.current = field;
      paint(field);
      draws += 1;
      if (ATLAS_TEST_MAP) (window as unknown as { __atlasField?: unknown }).__atlasField = { canvas, draws, field };
      setShown(field);
    };

    const loader = createFieldLoader({
      fetchField,
      size: () => ({ width: map.getContainer().clientWidth, height: map.getContainer().clientHeight }),
      onField: draw,
    });
    const stop = port.subscribe((event) => loader.onCamera(event));
    loader.start(port.get());
    return () => {
      stop();
      loader.dispose();
      if (map.getLayer(TINT)) map.removeLayer(TINT);
      if (map.getLayer(LAYER)) map.removeLayer(LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      if (ATLAS_TEST_MAP) delete (window as unknown as { __atlasField?: unknown }).__atlasField;
      setShown(null);
      paintRef.current = null;
      fieldRef.current = null;
    };
  }, [map, port, onColors]);

  useEffect(() => {
    if (!map || !shown) return;
    if (map.getLayer(LAYER)) map.setPaintProperty(LAYER, "raster-opacity", opacity);
    if (map.getLayer(TINT)) map.setPaintProperty(TINT, "raster-opacity", tint);
  }, [map, shown, opacity, tint]);

  useEffect(() => {
    instantRef.current = instant;
    if (fieldRef.current) paintRef.current?.(fieldRef.current);
  }, [instant]);

  if (!shown) return null;
  const nowOnly = fieldColorsAt(shown, instant).nowOnly;
  const km = Math.round(shown.step * 111);
  return (
    <p
      data-atlas-field-note
      data-provider={shown.provider}
      className="pointer-events-none absolute bottom-[calc(var(--dock-room)+7.5rem+3.5rem+4.5rem)] left-[max(1rem,env(safe-area-inset-left))] z-10 max-w-[min(20rem,calc(100%-2rem))] text-xs uppercase tracking-[0.14em] text-ink-muted"
    >
      {shown.provider === "mock" ? "Dati di esempio" : "Colori del meteo"} · modello, sfumato tra punti a circa {km} km{nowOnly ? " · i colori della mappa sono di adesso" : ""}
    </p>
  );
}
