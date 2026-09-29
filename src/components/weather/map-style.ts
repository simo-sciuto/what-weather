import type { MapLayer } from "@/lib/weather/palette";
import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from "mapbox-gl";

/*
 * The city as the page draws it, shared by the map behind the page and the
 * poster: Mapbox Streets reduced to water and three ranks of road.
 */

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
export const STYLE: StyleSpecification = {
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
export const KIND: Record<MapLayer, "fill" | "line"> = {
  water: "fill",
  waterway: "line",
  streets: "line",
  "main-roads": "line",
  motorways: "line",
};
