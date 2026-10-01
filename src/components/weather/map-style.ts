import type { MapOption } from "@/lib/map-options";
import type { MapInk, MapLayer } from "@/lib/weather/palette";
import type { SunPosition } from "@/lib/weather/sun-position";
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, Map, StyleSpecification } from "mapbox-gl";

/*
 * The city as the page draws it, shared by the map behind the page and the
 * poster: Mapbox Streets reduced to water and three ranks of road, and, when
 * the viewer asks (see map-options.ts), meadows, relief, contours, rails,
 * buildings and their shadows, the traffic, and the city's lights at night.
 * The extra layers are in the style from the start but hidden, and a hidden
 * layer asks Mapbox for nothing: what is not chosen costs no tiles.
 */

/** A road class filter on Mapbox Streets' `road` layer (lines only). */
/**
 * The metres above sea level at which the contours' ramp changes colour: close together in the lowlands,
 * where a city's hills are, and far apart towards the Alps.
 */
const ELEVATION_STOPS = [0, 150, 400, 800, 1500, 2500, 3500];

/** A layer's own layout, hidden: never one object shared between layers, which would show or hide them all together. */
const hidden = () => ({ visibility: "none" as const });

/** The road classes of each rank: the streets' are the rest */
const MOTORWAY_CLASSES = ["motorway", "motorway_link"];
const MAIN_CLASSES = ["secondary", "primary", "primary_link", "trunk", "trunk_link"];
const STREET_CLASSES = ["street", "street_limited", "tertiary", "tertiary_link", "secondary_link"];
/** The kinds of water that have a name on the map */
const WATER_CLASSES = ["water", "sea", "ocean", "bay", "reservoir", "river", "stream", "canal"];

/** A colour or a width that depends on the rank of the road it is on (a feature's `class`): streets, main roads, motorways */
const byRank = <T extends string | number>(streets: T, main: T, motorway: T): ExpressionSpecification => [
  "match",
  ["get", "class"],
  MOTORWAY_CLASSES,
  motorway,
  MAIN_CLASSES,
  main,
  streets,
];

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
 * A traffic line's width: as broad as the road it is on or broader, so it can't be missed, each rank of
 * road having its own. `scale` makes the slower traffic broader still.
 */
const trafficWidth = (scale: number): ExpressionSpecification => {
  const w = (n: number) => +(n * scale).toFixed(2);
  return ["interpolate", ["linear"], ["zoom"], 10, byRank(w(0.5), w(0.9), w(1.3)), 15, byRank(w(1.8), w(3), w(4))];
};

/**
 * How soft a traffic line's edges are, as a share of its width: the slower the traffic, the softer, so
 * a jam is a broad wash of colour and a slow patch a light touch, like strokes of a brush.
 */
const trafficBlur = (scale: number, softness: number): ExpressionSpecification => {
  const b = (n: number) => +(n * scale * softness).toFixed(2);
  return ["interpolate", ["linear"], ["zoom"], 10, byRank(b(0.5), b(0.9), b(1.3)), 15, byRank(b(1.8), b(3), b(4))];
};

/**
 * The map as a drawing: only the city's lines, and nothing else. No background layer, so the canvas is transparent
 * wherever there is no line and the sky shows through as it is: no blend
 * mode needed (a blended WebGL canvas isn't reliable across browsers), and
 * the colours are exactly as set. These are only the first ones: once drawn,
 * every layer takes the colours opposite the sky of the moment on show.
 */
export const STYLE: StyleSpecification = {
  version: 8,
  // The letters of the waters' names
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  sources: {
    streets: { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" },
    terrain: { type: "vector", url: "mapbox://mapbox.mapbox-terrain-v2" },
    elevation: { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 514, maxzoom: 14 },
    traffic: { type: "vector", url: "mapbox://mapbox.mapbox-traffic-v1" },
  },
  layers: [
    // Under everything: the ground
    {
      id: "green",
      type: "fill",
      source: "streets",
      "source-layer": "landuse",
      layout: hidden(),
      filter: ["match", ["get", "class"], ["park", "grass", "wood", "scrub"], true, false],
      paint: { "fill-color": "#b9e0b0", "fill-opacity": 0.3 },
    },
    {
      id: "relief",
      type: "hillshade",
      source: "elevation",
      layout: hidden(),
      paint: { "hillshade-illumination-anchor": "map", "hillshade-illumination-direction": 335 },
    },
    {
      id: "shadows",
      type: "fill",
      source: "streets",
      "source-layer": "building",
      layout: hidden(),
      paint: { "fill-color": "#000000", "fill-opacity": 0.3, "fill-translate-anchor": "map" },
    },
    {
      id: "buildings",
      type: "fill",
      source: "streets",
      "source-layer": "building",
      layout: hidden(),
      paint: { "fill-color": "#eeeeee", "fill-opacity": 0.3 },
    },
    {
      id: "water",
      type: "fill",
      source: "streets",
      "source-layer": "water",
      paint: { "fill-color": "#9ce0f7", "fill-opacity": 0.35 },
    },
    {
      id: "contours",
      type: "line",
      source: "terrain",
      "source-layer": "contour",
      layout: hidden(),
      // Fine lines, like the page's streets, each in the colour of its height (see syncMap); every fifth a little stronger
      paint: {
        "line-color": "#eeeeee",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["case", [">", ["get", "index"], 0], 0.7, 0.35],
          15,
          ["case", [">", ["get", "index"], 0], 1.5, 0.7],
        ],
        "line-opacity": 0.5,
      },
    },
    {
      id: "waterway",
      type: "line",
      source: "streets",
      "source-layer": "waterway",
      paint: { "line-color": "#9ce0f7", "line-width": width(0.8, 2.5), "line-opacity": 0.85 },
    },
    {
      id: "rail",
      type: "line",
      source: "streets",
      "source-layer": "road",
      layout: hidden(),
      filter: ["match", ["get", "class"], ["major_rail", "minor_rail"], true, false],
      paint: { "line-color": "#eeeeee", "line-width": width(0.5, 1.4), "line-dasharray": [3, 2], "line-opacity": 0.6 },
    },
    {
      id: "streets",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(STREET_CLASSES),
      paint: { "line-color": "#eebae8", "line-width": width(0.3, 1.6), "line-opacity": 0.7 },
    },
    {
      id: "main-roads",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(MAIN_CLASSES),
      paint: { "line-color": "#fec89c", "line-width": width(0.8, 3), "line-opacity": 0.9 },
    },
    {
      id: "motorways",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(MOTORWAY_CLASSES),
      paint: { "line-color": "#f9e8a7", "line-width": width(1.2, 4), "line-opacity": 0.95 },
    },
    // The traffic, as strokes of a brush on the road it is on, in a colour that stands against that road's
    ...(
      [
        ["traffic-slow", "moderate", 0.9, 0.6],
        ["traffic-heavy", "heavy", 1.2, 1],
        ["traffic-jam", "severe", 1.6, 1.5],
      ] as const
    ).map(
      ([id, congestion, scale, softness]): LayerSpecification => ({
        id,
        type: "line",
        source: "traffic",
        "source-layer": "traffic",
        layout: { ...hidden(), "line-cap": "round", "line-join": "round" },
        filter: ["==", ["get", "congestion"], congestion],
        paint: { "line-color": "#f9e8a7", "line-width": trafficWidth(scale), "line-blur": trafficBlur(scale, softness), "line-opacity": 0.9 },
      }),
    ),
    // The names of the waters, and only the waters' (the page's own words stay on the page)
    ...(
      [
        ["water-names", "Point", "point"],
        ["waterway-names", "LineString", "line"],
      ] as const
    ).map(
      ([id, geometry, placement]): LayerSpecification => ({
        id,
        type: "symbol",
        source: "streets",
        "source-layer": "natural_label",
        filter: [
          "all",
          ["==", ["geometry-type"], geometry],
          ["match", ["get", "class"], WATER_CLASSES, true, false],
        ],
        layout: {
          "symbol-placement": placement,
          "text-field": ["coalesce", ["get", "name_it"], ["get", "name"]],
          "text-font": ["DIN Pro Italic", "Arial Unicode MS Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 14],
          "text-letter-spacing": 0.12,
          "text-max-width": 8,
        },
        paint: { "text-color": "#eeeeee", "text-opacity": 0.8 },
      }),
    ),
    // The places that are lit, glowing at night
    {
      id: "lights",
      type: "circle",
      source: "streets",
      "source-layer": "poi_label",
      layout: hidden(),
      filter: ["<=", ["get", "filterrank"], 3],
      paint: {
        "circle-color": "#f9e8a7",
        "circle-opacity": 0.8,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 3.2],
        "circle-blur": 0.7,
      },
    },
  ],
};

/** What each layer is drawn as: its colour and opacity follow the sky (see mapInks in palette.ts) */
const KIND: Record<MapLayer, "fill" | "line" | "circle" | "hillshade" | "heights" | "ranked" | "text"> = {
  water: "fill",
  waterway: "line",
  streets: "line",
  "main-roads": "line",
  motorways: "line",
  green: "fill",
  relief: "hillshade",
  contours: "heights",
  rail: "line",
  buildings: "fill",
  shadows: "fill",
  "traffic-slow": "ranked",
  "traffic-heavy": "ranked",
  "traffic-jam": "ranked",
  lights: "circle",
  "water-names": "text",
  "waterway-names": "text",
};

/** The layers each option the viewer may choose turns on */
const OPTION_LAYERS: Record<MapOption, MapLayer[]> = {
  water: ["water", "waterway"],
  "water-names": ["water-names", "waterway-names"],
  streets: ["streets"],
  "main-roads": ["main-roads"],
  motorways: ["motorways"],
  green: ["green"],
  relief: ["relief"],
  contours: ["contours"],
  rail: ["rail"],
  buildings: ["buildings"],
  shadows: ["shadows"],
  traffic: ["traffic-slow", "traffic-heavy", "traffic-jam"],
  lights: ["lights"],
};

const rad = (d: number) => (d * Math.PI) / 180;
const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** A typical building's height, in metres: the shadows are all cast by one, since a fill can't take each its own. */
const SHADOW_BUILDING = 15;
/** Below this the sun is too low for a shadow to be drawn at its true length: it would run off the map. */
const SHADOW_MIN_ALTITUDE = 5;
const SHADOW_MAX_LENGTH = 120;
/** The zooms at which a building's shadow is measured; between them it grows with the map. */
const SHADOW_ZOOMS = [13, 17] as const;

/**
 * The offset, in pixels, that sets a building's footprint where its shadow
 * falls: away from the sun, as long as a typical building's shadow at this
 * sun height. Given at two zooms and doubled between them (the map's scale
 * doubles with each), so it is exact at every zoom, not only at those two.
 */
function shadowOffset(sun: SunPosition, lat: number): ExpressionSpecification {
  const metres = Math.min(SHADOW_BUILDING / Math.tan(rad(Math.max(sun.altitude, SHADOW_MIN_ALTITUDE))), SHADOW_MAX_LENGTH);
  const east = -Math.sin(rad(sun.azimuth)) * metres;
  // The screen's y runs down: a shadow that falls to the north goes up
  const down = Math.cos(rad(sun.azimuth)) * metres;
  const at = (zoom: number): ExpressionSpecification => {
    const pixels = 2 ** zoom / (156_543.03 * Math.cos(rad(lat)));
    return ["literal", [+(east * pixels).toFixed(2), +(down * pixels).toFixed(2)]];
  };
  return ["interpolate", ["exponential", 2], ["zoom"], SHADOW_ZOOMS[0], at(SHADOW_ZOOMS[0]), SHADOW_ZOOMS[1], at(SHADOW_ZOOMS[1])];
}

/** How much of the relief's shading shows: strongest when the sun is low and shadows are long. */
function reliefStrength(altitude: number): number {
  if (altitude <= 0) return 0.25;
  return 0.9 - (Math.min(altitude, 60) / 60) * 0.5;
}

export interface MapScene {
  /** The colours of every layer, opposite the sky of the moment on show */
  inks: Record<MapLayer, MapInk>;
  /** The extra layers the viewer chose */
  options: readonly MapOption[];
  /** Where the sun is at the moment on show, for the shadows and the lights */
  sun: SunPosition;
  /** The place's latitude, for the scale of the shadows */
  lat: number;
}

/**
 * Sets the map to a scene: every layer in its colour, the chosen extras
 * shown and the rest hidden, and the sun where it is. One place for it, so
 * the map behind the page and the poster can't draw it differently. Layers
 * that make no sense at this hour stay hidden although chosen: no shadows
 * once the sun has set, no lights while it is up.
 */
export function syncMap(map: Map, { inks, options, sun, lat }: MapScene) {
  for (const layer of Object.keys(KIND) as MapLayer[]) {
    const { color, opacity } = inks[layer];
    switch (KIND[layer]) {
      case "fill":
        map.setPaintProperty(layer, "fill-color", color);
        map.setPaintProperty(layer, "fill-opacity", opacity);
        break;
      case "line":
        map.setPaintProperty(layer, "line-color", color);
        map.setPaintProperty(layer, "line-opacity", opacity);
        break;
      case "circle":
        map.setPaintProperty(layer, "circle-color", color);
        map.setPaintProperty(layer, "circle-opacity", opacity);
        break;
      case "ranked": {
        // The colour of each rank of road, its own complement (see the palette's ramp for traffic)
        const [streets, main, motorway] = inks[layer].ramp ?? [color, color, color];
        map.setPaintProperty(layer, "line-color", byRank(streets, main, motorway));
        map.setPaintProperty(layer, "line-opacity", opacity);
        break;
      }
      case "text":
        map.setPaintProperty(layer, "text-color", color);
        map.setPaintProperty(layer, "text-opacity", opacity);
        break;
      case "heights":
        // Each contour in the colour of its height: the ramp's stops laid along the metres they stand for
        map.setPaintProperty(layer, "line-color", [
          "interpolate",
          ["linear"],
          ["get", "ele"],
          ...ELEVATION_STOPS.flatMap((metres, i) => [metres, inks[layer].ramp?.[i] ?? color]),
        ]);
        map.setPaintProperty(layer, "line-opacity", opacity);
        break;
      case "hillshade":
        // The lit side barely, the other in the sky's own shadow: the relief is shading, and has no lines
        map.setPaintProperty(layer, "hillshade-highlight-color", rgba(color, opacity * 0.4));
        map.setPaintProperty(layer, "hillshade-shadow-color", rgba(inks.shadows.color, inks.shadows.opacity));
        map.setPaintProperty(layer, "hillshade-accent-color", rgba(inks.shadows.color, inks.shadows.opacity));
        map.setPaintProperty(layer, "hillshade-illumination-direction", sun.altitude > 0 ? Math.round(sun.azimuth) % 360 : 335);
        map.setPaintProperty(layer, "hillshade-exaggeration", reliefStrength(sun.altitude));
        break;
    }
  }
  map.setPaintProperty("shadows", "fill-translate", shadowOffset(sun, lat));

  const chosen = new Set(options);
  const visible = new Set<MapLayer>(options.flatMap((o) => OPTION_LAYERS[o]));
  if (sun.altitude <= 0) visible.delete("shadows");
  if (sun.altitude > 0 || !chosen.has("lights")) visible.delete("lights");
  for (const layers of Object.values(OPTION_LAYERS)) {
    for (const layer of layers) map.setLayoutProperty(layer, "visibility", visible.has(layer) ? "visible" : "none");
  }
}
