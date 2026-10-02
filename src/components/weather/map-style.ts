import type { MapOption } from "@/lib/map-options";
import type { MapInk, MapLayer } from "@/lib/weather/palette";
import type { SunPosition } from "@/lib/weather/sun-position";
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  Map,
  StyleSpecification,
} from "mapbox-gl";

/*
 * The city as the page draws it, shared by the map behind the page and the
 * poster: Mapbox Streets reduced to water and three ranks of road, and, when
 * the viewer asks (see map-options.ts), meadows, relief, contours, the ways of getting about (trains, metro, trams, buses),
 * buildings (outlines, or in 3D) and their shadows, the traffic, and the city's lights at night.
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
const MAIN_CLASSES = [
  "secondary",
  "primary",
  "primary_link",
  "trunk",
  "trunk_link",
];
const STREET_CLASSES = [
  "street",
  "street_limited",
  "tertiary",
  "tertiary_link",
  "secondary_link",
];
/** A colour or a width that depends on the rank of the road it is on (a feature's `class`): streets, main roads, motorways */
const byRank = <T extends string | number>(
  streets: T,
  main: T,
  motorway: T,
): ExpressionSpecification => [
  "match",
  ["get", "class"],
  MOTORWAY_CLASSES,
  motorway,
  MAIN_CLASSES,
  main,
  streets,
];

/** The lines of one kind of rail: by their `type` (rail, subway, tram...), and, if given, only of these classes */
const transitLines = (
  types: string[],
  classes?: string[],
): FilterSpecification => [
  "all",
  ["==", ["geometry-type"], "LineString"],
  ["match", ["get", "type"], types, true, false],
  ...(classes
    ? [
        [
          "match",
          ["get", "class"],
          classes,
          true,
          false,
        ] as ExpressionSpecification,
      ]
    : []),
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
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    byRank(w(0.5), w(0.9), w(1.3)),
    15,
    byRank(w(1.8), w(3), w(4)),
  ];
};

/**
 * How soft a traffic line's edges are, as a share of its width: the slower the traffic, the softer, so
 * a jam is a broad wash of colour and a slow patch a light touch, like strokes of a brush.
 */
const trafficBlur = (
  scale: number,
  softness: number,
): ExpressionSpecification => {
  const b = (n: number) => +(n * scale * softness).toFixed(2);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    byRank(b(0.5), b(0.9), b(1.3)),
    15,
    byRank(b(1.8), b(3), b(4)),
  ];
};

/** The shadow under each rank of road: its layer, the road classes it follows, its width at zooms 10 and 15, and the choice it goes with */
const ROAD_SHADOWS: {
  id: string;
  option: "streets" | "main-roads" | "motorways";
  classes: string[];
  at10: number;
  at15: number;
}[] = [
  {
    id: "streets-shadow",
    option: "streets",
    classes: STREET_CLASSES,
    at10: 1,
    at15: 3.6,
  },
  {
    id: "main-roads-shadow",
    option: "main-roads",
    classes: MAIN_CLASSES,
    at10: 1.8,
    at15: 6,
  },
  {
    id: "motorways-shadow",
    option: "motorways",
    classes: MOTORWAY_CLASSES,
    at10: 2.6,
    at15: 8,
  },
];

/** The stops of each way of getting about: what the data calls it, whether only its stations count, from which zoom, how large a dot */
const STOPS: {
  id: string;
  mode: string;
  stationsOnly: boolean;
  minzoom: number;
  radius: [number, number];
}[] = [
  {
    id: "train-stops",
    mode: "rail",
    stationsOnly: true,
    minzoom: 11,
    radius: [2, 5],
  },
  // The metro's entrances are left out: a station has many
  {
    id: "metro-stops",
    mode: "metro_rail",
    stationsOnly: true,
    minzoom: 11,
    radius: [2, 5],
  },
  {
    id: "tram-stops",
    mode: "tram",
    stationsOnly: false,
    minzoom: 14,
    radius: [1.2, 3],
  },
  // The data has the trams' and the buses' stops from zoom 14, and no more than that
  {
    id: "bus-stops",
    mode: "bus",
    stationsOnly: false,
    minzoom: 14,
    radius: [1, 2.6],
  },
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
  sources: {
    streets: { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" },
    terrain: { type: "vector", url: "mapbox://mapbox.mapbox-terrain-v2" },
    elevation: {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 514,
      maxzoom: 14,
    },
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
      filter: [
        "match",
        ["get", "class"],
        ["park", "grass", "wood", "scrub"],
        true,
        false,
      ],
      paint: { "fill-color": "#b9e0b0", "fill-opacity": 0.3 },
    },
    {
      id: "relief",
      type: "hillshade",
      source: "elevation",
      layout: hidden(),
      paint: {
        "hillshade-illumination-anchor": "map",
        "hillshade-illumination-direction": 335,
      },
    },
    {
      id: "shadows",
      type: "fill",
      source: "streets",
      "source-layer": "building",
      layout: hidden(),
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0.3,
        "fill-translate-anchor": "map",
      },
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
      paint: {
        "line-color": "#9ce0f7",
        "line-width": width(0.8, 2.5),
        "line-opacity": 0.85,
      },
    },
    // The ways of getting about, plain lines like the roads (no dashes to stand for tracks), each in its own
    // colour. The data has them from different zooms: the metro's lines from 11, its stations and the buildings
    // from 13, the trams and the bus stops from 14 (Mapbox Streets' tiles).
    {
      id: "train",
      type: "line",
      source: "streets",
      "source-layer": "road",
      layout: hidden(),
      filter: transitLines(
        ["rail", "narrow_gauge"],
        ["major_rail", "minor_rail"],
      ),
      paint: {
        "line-color": "#eeeeee",
        "line-width": width(0.7, 2),
        "line-opacity": 0.8,
      },
    },
    {
      id: "metro",
      type: "line",
      source: "streets",
      "source-layer": "road",
      layout: hidden(),
      filter: transitLines(["subway", "light_rail", "monorail"]),
      paint: {
        "line-color": "#eeeeee",
        "line-width": width(0.7, 2),
        "line-opacity": 0.8,
      },
    },
    {
      id: "tram",
      type: "line",
      source: "streets",
      "source-layer": "road",
      layout: hidden(),
      filter: transitLines(["tram", "funicular"]),
      paint: {
        "line-color": "#eeeeee",
        "line-width": width(0.6, 1.6),
        "line-opacity": 0.8,
      },
    },
    // A light shadow under each rank of road, so they lift off the sky a little: the road's own lines drawn
    // a touch broader, a deep dark, blurred and moved down, under them (a line has no shadow of its own in
    // Mapbox). A fixed colour: the sky's own shadow is nearly the sky itself at night, and would not show.
    // Each is shown with its rank of road and goes when that road does (see ROAD_SHADOWS).
    ...ROAD_SHADOWS.map(({ id, classes, at10, at15 }): LayerSpecification => ({
      id,
      type: "line",
      source: "streets",
      "source-layer": "road",
      layout: hidden(),
      filter: roads(classes),
      paint: {
        "line-color": "#04050f",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, at10, 15, at15],
        "line-blur": 1.6,
        "line-translate": [0, 1],
        "line-opacity": 0.58,
      },
    })),
    {
      id: "streets",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(STREET_CLASSES),
      paint: {
        "line-color": "#eebae8",
        "line-width": width(0.3, 1.6),
        "line-opacity": 0.7,
      },
    },
    {
      id: "main-roads",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(MAIN_CLASSES),
      paint: {
        "line-color": "#fec89c",
        "line-width": width(0.8, 3),
        "line-opacity": 0.9,
      },
    },
    {
      id: "motorways",
      type: "line",
      source: "streets",
      "source-layer": "road",
      filter: roads(MOTORWAY_CLASSES),
      paint: {
        "line-color": "#f9e8a7",
        "line-width": width(1.2, 4),
        "line-opacity": 0.95,
      },
    },
    // The buildings as volumes, as tall as they are, over the roads: seen from above they are their outlines,
    // and the map's tilt (see MapBackdropGL) is what shows their height
    {
      id: "buildings-3d",
      type: "fill-extrusion",
      source: "streets",
      "source-layer": "building",
      minzoom: 13,
      layout: hidden(),
      filter: ["==", ["get", "extrude"], "true"],
      paint: {
        "fill-extrusion-color": "#eeeeee",
        "fill-extrusion-height": [
          "max",
          ["to-number", ["get", "height"], 6],
          3,
        ],
        "fill-extrusion-base": ["to-number", ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.8,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    // The traffic, as strokes of a brush on the road it is on, in a colour that stands against that road's
    ...(
      [
        ["traffic-slow", "moderate", 0.9, 0.6],
        ["traffic-heavy", "heavy", 1.2, 1],
        ["traffic-jam", "severe", 1.6, 1.5],
      ] as const
    ).map(([id, congestion, scale, softness]): LayerSpecification => ({
      id,
      type: "line",
      source: "traffic",
      "source-layer": "traffic",
      layout: { ...hidden(), "line-cap": "round", "line-join": "round" },
      filter: ["==", ["get", "congestion"], congestion],
      paint: {
        "line-color": "#f9e8a7",
        "line-width": trafficWidth(scale),
        "line-blur": trafficBlur(scale, softness),
        "line-opacity": 0.9,
      },
    })),
    // The stops and stations of the ways of getting about, a dot each in the colour of its line (the metro's
    // entrances are left out); the buses' are many, so they come only when the map is close
    ...STOPS.map(
      ({ id, mode, stationsOnly, minzoom, radius }): LayerSpecification => ({
        id,
        type: "circle",
        source: "streets",
        "source-layer": "transit_stop_label",
        minzoom,
        layout: hidden(),
        filter: stationsOnly
          ? [
              "all",
              ["==", ["get", "mode"], mode],
              ["==", ["get", "stop_type"], "station"],
            ]
          : ["==", ["get", "mode"], mode],
        paint: {
          "circle-color": "#eeeeee",
          "circle-opacity": 0.8,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            radius[0],
            17,
            radius[1],
          ],
          "circle-stroke-width": 0.6,
          "circle-stroke-color": "#000000",
          "circle-stroke-opacity": 0.25,
        },
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
const KIND: Record<
  MapLayer,
  "fill" | "line" | "circle" | "hillshade" | "heights" | "ranked" | "extrusion"
> = {
  water: "fill",
  waterway: "line",
  streets: "line",
  "main-roads": "line",
  motorways: "line",
  green: "fill",
  relief: "hillshade",
  contours: "heights",
  train: "line",
  "train-stops": "circle",
  metro: "line",
  "metro-stops": "circle",
  tram: "line",
  "tram-stops": "circle",
  "bus-stops": "circle",
  buildings: "fill",
  "buildings-3d": "extrusion",
  shadows: "fill",
  "traffic-slow": "ranked",
  "traffic-heavy": "ranked",
  "traffic-jam": "ranked",
  lights: "circle",
};

/** The layers each option the viewer may choose turns on */
export const OPTION_LAYERS: Record<MapOption, MapLayer[]> = {
  water: ["water", "waterway"],
  streets: ["streets"],
  "main-roads": ["main-roads"],
  motorways: ["motorways"],
  green: ["green"],
  relief: ["relief"],
  contours: ["contours"],
  train: ["train", "train-stops"],
  metro: ["metro", "metro-stops"],
  tram: ["tram", "tram-stops"],
  bus: ["bus-stops"],
  buildings: ["buildings"],
  "buildings-3d": ["buildings-3d"],
  shadows: ["shadows"],
  traffic: ["traffic-slow", "traffic-heavy", "traffic-jam"],
  lights: ["lights"],
};

/** The layers the chosen options turn on */
export const activeLayers = (options: readonly MapOption[]): Set<MapLayer> =>
  new Set(options.flatMap((o) => OPTION_LAYERS[o]));

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
  const metres = Math.min(
    SHADOW_BUILDING /
      Math.tan(rad(Math.max(sun.altitude, SHADOW_MIN_ALTITUDE))),
    SHADOW_MAX_LENGTH,
  );
  const east = -Math.sin(rad(sun.azimuth)) * metres;
  // The screen's y runs down: a shadow that falls to the north goes up
  const down = Math.cos(rad(sun.azimuth)) * metres;
  const at = (zoom: number): ExpressionSpecification => {
    const pixels = 2 ** zoom / (156_543.03 * Math.cos(rad(lat)));
    return [
      "literal",
      [+(east * pixels).toFixed(2), +(down * pixels).toFixed(2)],
    ];
  };
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    SHADOW_ZOOMS[0],
    at(SHADOW_ZOOMS[0]),
    SHADOW_ZOOMS[1],
    at(SHADOW_ZOOMS[1]),
  ];
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
  /** How much larger than on the page the roads' shadows are drawn (the poster is a large picture: 1 on the page) */
  roadShadowScale?: number;
}

/**
 * Sets the map to a scene: every layer in its colour, the chosen extras
 * shown and the rest hidden, and the sun where it is. One place for it, so
 * the map behind the page and the poster can't draw it differently. Layers
 * that make no sense at this hour stay hidden although chosen: no shadows
 * once the sun has set, no lights while it is up.
 */
export function syncMap(
  map: Map,
  { inks, options, sun, lat, roadShadowScale = 1 }: MapScene,
) {
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
      case "extrusion":
        map.setPaintProperty(layer, "fill-extrusion-color", color);
        map.setPaintProperty(layer, "fill-extrusion-opacity", opacity);
        break;
      case "circle":
        map.setPaintProperty(layer, "circle-color", color);
        map.setPaintProperty(layer, "circle-opacity", opacity);
        break;
      case "ranked": {
        // The colour of each rank of road, its own complement (see the palette's ramp for traffic)
        const [streets, main, motorway] = inks[layer].ramp ?? [
          color,
          color,
          color,
        ];
        map.setPaintProperty(
          layer,
          "line-color",
          byRank(streets, main, motorway),
        );
        map.setPaintProperty(layer, "line-opacity", opacity);
        break;
      }
      case "heights":
        // Each contour in the colour of its height: the ramp's stops laid along the metres they stand for
        map.setPaintProperty(layer, "line-color", [
          "interpolate",
          ["linear"],
          ["get", "ele"],
          ...ELEVATION_STOPS.flatMap((metres, i) => [
            metres,
            inks[layer].ramp?.[i] ?? color,
          ]),
        ]);
        map.setPaintProperty(layer, "line-opacity", opacity);
        break;
      case "hillshade":
        // The lit side barely, the other in the sky's own shadow: the relief is shading, and has no lines
        map.setPaintProperty(
          layer,
          "hillshade-highlight-color",
          rgba(color, opacity * 0.4),
        );
        map.setPaintProperty(
          layer,
          "hillshade-shadow-color",
          rgba(inks.shadows.color, inks.shadows.opacity),
        );
        map.setPaintProperty(
          layer,
          "hillshade-accent-color",
          rgba(inks.shadows.color, inks.shadows.opacity),
        );
        map.setPaintProperty(
          layer,
          "hillshade-illumination-direction",
          sun.altitude > 0 ? Math.round(sun.azimuth) % 360 : 335,
        );
        map.setPaintProperty(
          layer,
          "hillshade-exaggeration",
          reliefStrength(sun.altitude),
        );
        break;
    }
  }
  map.setPaintProperty("shadows", "fill-translate", shadowOffset(sun, lat));

  const chosen = new Set(options);
  const visible = new Set<MapLayer>(options.flatMap((o) => OPTION_LAYERS[o]));
  if (sun.altitude <= 0) visible.delete("shadows");
  if (sun.altitude > 0 || !chosen.has("lights")) visible.delete("lights");
  // The shadow under each rank of road is there while that road is, and goes with it
  for (const { id, option } of ROAD_SHADOWS) {
    map.setPaintProperty(id, "line-translate", [
      0,
      +(1.2 * roadShadowScale).toFixed(2),
    ]);
    map.setPaintProperty(id, "line-blur", +(1.6 * roadShadowScale).toFixed(2));
    map.setLayoutProperty(
      id,
      "visibility",
      chosen.has(option) ? "visible" : "none",
    );
  }
  for (const layers of Object.values(OPTION_LAYERS)) {
    for (const layer of layers)
      map.setLayoutProperty(
        layer,
        "visibility",
        visible.has(layer) ? "visible" : "none",
      );
  }
}
