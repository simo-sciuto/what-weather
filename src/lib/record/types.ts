/**
 * The Visual Record engine (WTH-187): weather, place and geography in, a renderer-independent scene out.
 *
 * Space: every position is normalized, x over the sheet's width and y over its height (0..1). Every length
 * (a type size, a stroke, a radius) is a fraction of the sheet's width, so a scene draws at any resolution.
 */
import type { Condition, Intensity } from "@/lib/weather/types";

export type ConditionFamily = "CLEAR" | "CLOUD" | "FOG" | "RAIN" | "STORM" | "SNOW" | "WIND";

export type CompositionMode = "open-atlas" | "collision" | "vertical-field";

export type Dominant = "place" | "temperature";

/** How geography and the dominant type meet: lines across the letters, or a band of lines in front of them */
export type Interplay = "through" | "interleave" | "none";

export type InkRole = "paper" | "ink-1" | "ink-2" | "accent";

export type Point = readonly [number, number];
/** [lon, lat] */
export type LonLat = readonly [number, number];

/** Vector geography around a place, in degrees: whatever the source (Natural Earth, Mapbox's tiles) */
export type Geography = {
  coast: LonLat[][];
  border: LonLat[][];
  river: LonLat[][];
  /** Sea and lakes: polygons, each a list of rings */
  water: LonLat[][][];
};

/** One record's facts, in the project's units (°C, km/h, km, %, mm/h, hPa). Absent is not zero. */
export type RecordInput = {
  place: { name: string; lat: number; lon: number };
  /** The place's local calendar day, "2026-10-05" */
  date: string;
  /** The place's local clock, "12:00" */
  time: string;
  /** The place's offset as it is printed, "GMT+2" */
  zone: string;
  condition: Condition;
  intensity: Intensity;
  temp: number;
  feelsLike?: number;
  high?: number;
  low?: number;
  windSpeed?: number;
  windGust?: number;
  /** Meteorological degrees, where the wind comes from */
  windDeg?: number;
  humidity?: number;
  visibility?: number;
  cloudCover?: number;
  uv?: number;
  precipitation?: number;
  pressure?: number;
  /** `Frame.light`: -1..2, sunrise 0, sunset 1; midday when absent */
  light?: number;
};

export type FontRef = {
  family: "display" | "mono";
  wght: number;
  /** Percent of normal width; 100 for the mono */
  wdth: number;
  /** Fraction of the sheet's width */
  size: number;
  /** In em */
  tracking: number;
};

/** Measures a line set in `font`, as a fraction of the sheet's width; injected, so the engine stays pure */
export type Measure = (text: string, font: FontRef) => number;

export type TextLine = { text: string; x: number; y: number };

export type TextPayload = {
  kind: "text";
  lines: TextLine[];
  font: FontRef;
  anchor: "start" | "end";
};

export type PathsPayload = {
  kind: "paths";
  /** Normalized points; a polygon closes itself */
  paths: Point[][];
  closed: boolean;
  /** Stroke width, fraction of the sheet's width; 0 for a fill */
  stroke: number;
  dash?: readonly number[];
};

export type RectPayload = { kind: "rect"; x: number; y: number; width: number; height: number };

export type NodePayload = {
  kind: "node";
  shape: "dot" | "cross";
  at: Point;
  /** Radius, fraction of the sheet's width */
  r: number;
  /** From the node to its typographic handle */
  leader?: [Point, Point];
  label?: { text: string; at: Point; anchor: "start" | "end" };
};

export type LayerRole = "paper" | "terrain" | "type-back" | "linework" | "type-front" | "nodes" | "micro";

/** Where a layer is cut: a rectangle, and optionally the glyphs of a text layer (the letters' own shape) */
export type Clip = {
  rect?: RectPayload;
  /** The id of a text layer whose glyphs the layer is drawn inside */
  glyphsOf?: string;
};

export type Transform = { rotate: number; origin: Point };

export type SceneLayer = {
  id: string;
  role: LayerRole;
  z: number;
  inkRole: InkRole;
  opacity: number;
  transform?: Transform;
  clip?: Clip;
  payload: TextPayload | PathsPayload | RectPayload | NodePayload;
};

export type RecordScene = {
  canvas: { width: number; height: number };
  inks: Record<InkRole, string>;
  layers: SceneLayer[];
  metadata: {
    mode: CompositionMode;
    family: ConditionFamily;
    dominant: Dominant;
    interplay: Interplay;
    seed: number;
    visualThesis: string;
    recordId: string;
    /** How the place's name was fitted (`fitPlace` step) */
    placeFit: string;
    /** Geographic anchors used by the nodes */
    nodes: string[];
  };
};
