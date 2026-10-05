import { conditionFamily } from "./condition-family";
import { fitPlace, type Fitted } from "./fit";
import {
  centerFor,
  crossings,
  featureLength,
  placeGeography,
  type Crop,
  type FeatureKind,
  type Placed,
  type Rect,
} from "./geography";
import { recordInks } from "./inks";
import {
  CONDITION_WORD,
  degrees,
  formatCoord,
  formatDate,
  recordId,
  temperatureWords,
  weatherMetrics,
} from "./metrics";
import { clamp, cropKm, lerp, normTemp, spaceCompression, typePressure } from "./pressure";
import { mulberry32, recordSeed } from "./seed";
import { CAP_HEIGHT, FAMILY_TYPE, MICRO_SIZE, clampAxes, dominantFont } from "./type-system";
import type {
  CompositionMode,
  ConditionFamily,
  Dominant,
  FontRef,
  Geography,
  Interplay,
  Measure,
  NodePayload,
  Point,
  RecordInput,
  RecordScene,
  SceneLayer,
  TextLine,
} from "./types";

/* ---------- Decisions, in order: family, temperature, wind, visibility, humidity, seed ---------- */

/** Dense cloud from this cover (%) is a vertical record */
export const DENSE_CLOUD = 85;
/** A clear record is a collision from this temperature (°C) */
export const HOT = 25;
/** The temperature takes over a collision at this heat, an atlas at this cold (°C) */
export const TEMP_DOMINANT_HOT = 35;
export const TEMP_DOMINANT_COLD = -15;
/** Wind slants the dominant type from this speed (km/h), up to this angle (degrees) */
export const SLANT_FROM = 25;
export const SLANT_MAX = 7;

export function compositionMode(family: ConditionFamily, temp: number, cloudCover?: number): CompositionMode {
  switch (family) {
    case "FOG":
    case "SNOW":
      return "open-atlas";
    case "STORM":
      return "collision";
    case "RAIN":
    case "WIND":
      return "vertical-field";
    case "CLOUD":
      return (cloudCover ?? 0) >= DENSE_CLOUD ? "vertical-field" : "open-atlas";
    case "CLEAR":
      return temp >= HOT ? "collision" : "open-atlas";
  }
}

export function dominantOf(mode: CompositionMode, temp: number): Dominant {
  if (mode === "collision" && temp >= TEMP_DOMINANT_HOT) return "temperature";
  if (mode === "open-atlas" && temp <= TEMP_DOMINANT_COLD) return "temperature";
  return "place";
}

/** The wind's lean, in degrees: none below SLANT_FROM or without a direction; leaning the way it blows */
export function windSlant(speed?: number, deg?: number): number {
  if (speed == null || deg == null || speed < SLANT_FROM) return 0;
  const strength = clamp((speed - SLANT_FROM) / 35, 0, 1);
  // From the west (180..360) it pushes the type east: a lean to the right, which on screen is a negative turn
  const east = Math.sin((deg * Math.PI) / 180) < 0;
  return Math.round(strength * SLANT_MAX * (east ? -1 : 1) * 10) / 10;
}

/* ---------- The sheet's grid (sheet units: fractions of the width on both axes) ---------- */

export const PRINT = { width: 2480, height: 3508 } as const;
const M = 0.06;
const GUTTER = 0.016;
const COL = (1 - 2 * M - 5 * GUTTER) / 6;
const colX = (i: number) => M + i * (COL + GUTTER);
const colR = (i: number) => colX(i) + COL;
const LEAD = MICRO_SIZE * 1.7;

/* ---------- Text blocks with their handles ---------- */

type Block = {
  id: string;
  lines: TextLine[];
  widths: number[];
  font: FontRef;
  rotate: number;
  origin: Point;
};

function turn(p: Point, b: Pick<Block, "rotate" | "origin">): Point {
  if (!b.rotate) return p;
  const a = (b.rotate * Math.PI) / 180;
  const [cx, cy] = b.origin;
  const [dx, dy] = [p[0] - cx, p[1] - cy];
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** The foot of each glyph (its centre on the baseline), on the sheet; spaces have none */
function glyphFeet(b: Block, measure: Measure): { at: Point; line: number; index: number }[] {
  const out: { at: Point; line: number; index: number }[] = [];
  b.lines.forEach((l, li) => {
    for (let k = 0; k < l.text.length; k++) {
      if (l.text[k] === " ") continue;
      const before = k ? measure(l.text.slice(0, k), b.font) : 0;
      const through = measure(l.text.slice(0, k + 1), b.font);
      out.push({ at: turn([l.x + (before + through) / 2, l.y], b), line: li, index: k });
    }
  });
  return out;
}

/** Each line's baseline as a segment on the sheet */
function baselines(b: Block): [Point, Point][] {
  return b.lines.map((l, i) => [turn([l.x, l.y], b), turn([l.x + b.widths[i], l.y], b)]);
}

/** The block's bounding box on the sheet (rotation included) */
function bounds(b: Block): Rect {
  const pts = b.lines.flatMap((l, i) => [
    turn([l.x, l.y - CAP_HEIGHT * b.font.size], b),
    turn([l.x + b.widths[i], l.y - CAP_HEIGHT * b.font.size], b),
    turn([l.x, l.y], b),
    turn([l.x + b.widths[i], l.y], b),
  ]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function stack(id: string, fitted: Fitted, x: number, firstBase: number, measure: Measure, leading = 0.9): Block {
  const lines = fitted.lines.map((text, i) => ({ text, x, y: firstBase + i * fitted.font.size * leading }));
  return { id, lines, widths: lines.map((l) => measure(l.text, fitted.font)), font: fitted.font, rotate: 0, origin: [x, firstBase] };
}

/* ---------- The layout of each mode ---------- */

type Layout = {
  dominant: Block;
  /** The other of place and temperature, smaller */
  secondary: Block | null;
  slot: Rect;
  /** Where the water may be filled, when it differs from the slot (the ground starting at a baseline) */
  fillSlot?: Rect;
  interplay: Interplay;
  /** For INTERLEAVE: the band of the dominant type where the map runs in front */
  band?: Rect;
  /** Where the city may land: its typographic handle and the candidate spots in the slot */
  candidates: { handle: Point; spot: Point; reach: number }[];
  weatherAt: { x: number; top: number } | { x: number; bottom: number };
  metaAt: { x: number; bottom: number };
  signatureAt: { x: number; y: number; anchor: "start" | "end" };
  /** Minor motif: the record ID set up a rail */
  rail?: { x: number; top: number; bottom: number };
  /** Minor motif: the temperature in words under its numeral */
  numeralWord: boolean;
};

type Ctx = {
  r: RecordInput;
  family: ConditionFamily;
  t: number;
  tp: number;
  sc: number;
  aspect: number;
  measure: Measure;
  slant: number;
  weatherRows: number;
};

const temperatureText = (t: number) => degrees(t);
const upper = (s: string) => s.toLocaleUpperCase("en");

function secondaryTemp(c: Ctx, size: number, x: number, base: number): Block {
  const f = FAMILY_TYPE[c.family];
  const font = clampAxes({ family: "display", wght: lerp(f.wght[0], f.wght[1], c.tp), wdth: Math.min(f.wdth, 110), size, tracking: -0.02 });
  const text = temperatureText(c.r.temp);
  return { id: "temperature", lines: [{ text, x, y: base }], widths: [c.measure(text, font)], font, rotate: 0, origin: [x, base] };
}

function secondaryPlace(c: Ctx, size: number, x: number, base: number, maxWidth: number): Block {
  const f = FAMILY_TYPE[c.family];
  const fitted = fitPlace(upper(c.r.place.name), {
    font: dominantFont(c.family, c.tp, c.r.humidity, size),
    wdthMin: f.wdthMin,
    maxWidth,
    minSize: size * 0.6,
    maxLines: 2,
    measure: c.measure,
  });
  return stack("place", fitted, x, base, c.measure);
}

/** The weather cluster's height: numeral, word, pairs */
const weatherHeight = (c: Ctx, withNumeral: boolean, numeral: number) =>
  (withNumeral ? numeral * CAP_HEIGHT + 0.03 : 0) + 0.035 + c.weatherRows * LEAD;
const META_ROWS = 4;
const metaHeight = META_ROWS * LEAD;

function collision(c: Ctx, dominant: Dominant): Layout {
  const bottom = c.aspect - M;
  const clusterTop = bottom - Math.max(metaHeight, weatherHeight(c, dominant === "place", 0.11)) - lerp(0.02, 0.0, c.sc);
  const f = FAMILY_TYPE[c.family];
  if (dominant === "place") {
    // Oversized and pressed to the right edge: the width it may take grows with the heat
    const size = lerp(0.24, 0.33, c.tp);
    const fitted = fitPlace(upper(c.r.place.name), {
      font: dominantFont(c.family, c.tp, c.r.humidity, size),
      wdthMin: f.wdthMin,
      maxWidth: 1 - 2 * M + lerp(0, 0.05, c.tp),
      minSize: 0.1,
      maxLines: 3,
      measure: c.measure,
    });
    const s = fitted.font.size;
    const top = M + lerp(0.12, 0.05, c.sc);
    const dom = stack("dominant", fitted, M - s * 0.03, top + CAP_HEIGHT * s, c.measure);
    const last = dom.lines[dom.lines.length - 1];
    const slot = { x: colX(1), y: top - 0.04, w: 1 - colX(1), h: clusterTop - lerp(0.12, 0.06, c.sc) - (top - 0.04) };
    const below = (slot.y + slot.h - last.y) / 3;
    return {
      dominant: dom,
      secondary: null,
      slot,
      // The water starts on the name's last baseline: above it only the lines run, through the letters
      fillSlot: { ...slot, y: last.y, h: slot.y + slot.h - last.y },
      interplay: "through",
      candidates: [1, 2].flatMap((k) => feetSpots(c, dom, "down", [below * k])),
      weatherAt: { x: M, bottom },
      metaAt: { x: colX(3), bottom },
      signatureAt: { x: 1 - M, y: bottom, anchor: "end" },
      numeralWord: false,
    };
  }
  // GIANT DATA: the temperature, flush right with its degree in sight, pushed off the left edge in extreme heat
  const text = temperatureText(c.r.temp);
  const font0 = dominantFont(c.family, c.tp, c.r.humidity, 1);
  const unit = c.measure(text, { ...font0, size: 1 });
  const bleed = lerp(0, 0.18, clamp((c.r.temp - TEMP_DOMINANT_HOT) / 13, 0, 1));
  const size = Math.min(0.62, (1 - M) / (unit * (1 - bleed)));
  const font = { ...font0, size };
  const width = unit * size;
  const base = clusterTop - 0.1;
  const x = 1 - M - width;
  const dom: Block = { id: "dominant", lines: [{ text, x, y: base }], widths: [width], font, rotate: 0, origin: [x, base] };
  const capTop = base - CAP_HEIGHT * size;
  const place = secondaryPlace(c, 0.13, M, M + 0.06 + CAP_HEIGHT * 0.13, 1 - 2 * M);
  const placeBottom = place.lines[place.lines.length - 1].y;
  const slot = { x: 0, y: placeBottom + 0.05, w: 1, h: base + 0.04 - (placeBottom + 0.05) };
  const bandTop = base - CAP_HEIGHT * size * 0.3;
  const above = (capTop - slot.y) / 2;
  return {
    dominant: dom,
    secondary: place,
    slot,
    interplay: "interleave",
    band: { x: 0, y: bandTop, w: 1, h: base - bandTop + 0.01 },
    candidates: feetSpots(c, dom, "up", [above, above * 1.5].map((d) => d + CAP_HEIGHT * size)),
    weatherAt: { x: M, bottom },
    metaAt: { x: colX(3), bottom },
    signatureAt: { x: 1 - M, y: bottom, anchor: "end" },
    numeralWord: false,
  };
}

function atlas(c: Ctx, dominant: Dominant): Layout {
  const bottom = c.aspect - M;
  const f = FAMILY_TYPE[c.family];
  const air = lerp(0.14, 0.06, c.sc);
  if (dominant === "place") {
    const size = lerp(0.15, 0.2, c.tp);
    const fitted = fitPlace(upper(c.r.place.name), {
      font: dominantFont(c.family, c.tp, c.r.humidity, size),
      wdthMin: f.wdthMin,
      maxWidth: 1 - 2 * M,
      minSize: 0.08,
      maxLines: 3,
      measure: c.measure,
    });
    const s = fitted.font.size;
    const dom = stack("dominant", fitted, M - s * 0.03, M + 0.04 + CAP_HEIGHT * s, c.measure, 1.0);
    const last = dom.lines[dom.lines.length - 1];
    const slotTop = last.y + air + 0.02;
    // Open on the right: the map runs off the sheet rather than sitting in a box
    const slot = { x: colX(2), y: slotTop, w: 1 - colX(2), h: bottom - metaHeight - air - slotTop };
    const numeral = 0.12;
    const temp = secondaryTemp(c, numeral, M - numeral * 0.03, slotTop + CAP_HEIGHT * numeral);
    const reach = slot.y - last.y;
    return {
      dominant: dom,
      secondary: temp,
      slot,
      interplay: "none",
      candidates: feetSpots(c, dom, "down", [reach + slot.h * 0.18, reach + slot.h * 0.32]),
      weatherAt: { x: M, top: slotTop + CAP_HEIGHT * numeral + 0.03 },
      metaAt: { x: M, bottom },
      signatureAt: { x: 1 - M, y: bottom, anchor: "end" },
      numeralWord: true,
    };
  }
  // The temperature alone in a wide, sparse map, light and open; the place small above
  const place = secondaryPlace(c, 0.075, M, M + 0.04 + CAP_HEIGHT * 0.075, colR(4) - M);
  const placeBottom = place.lines[place.lines.length - 1].y;
  const clusters = Math.max(metaHeight, weatherHeight(c, false, 0));
  const slot = { x: colX(1), y: placeBottom + air, w: 1 - colX(1), h: bottom - clusters - air - (placeBottom + air) };
  const text = temperatureText(c.r.temp);
  const font0 = dominantFont(c.family, c.tp, c.r.humidity, 1);
  const unit = c.measure(text, { ...font0, size: 1 });
  const size = Math.min(0.4, (colR(5) - colX(1)) / unit);
  const font = { ...font0, size };
  const base = slot.y + slot.h * 0.5 + (CAP_HEIGHT * size) / 2;
  const x = colX(1) - size * 0.03;
  const dom: Block = { id: "dominant", lines: [{ text, x, y: base }], widths: [unit * size], font, rotate: 0, origin: [x, base] };
  return {
    dominant: dom,
    secondary: place,
    slot,
    interplay: "through",
    candidates: feetSpots(c, dom, "down", [slot.h * 0.14, slot.h * 0.24]),
    weatherAt: { x: M, bottom },
    metaAt: { x: colX(3), bottom },
    signatureAt: { x: 1 - M, y: bottom, anchor: "end" },
    numeralWord: false,
  };
}

function vertical(c: Ctx): Layout {
  const bottom = c.aspect - M;
  const f = FAMILY_TYPE[c.family];
  const size = lerp(0.3, 0.4, c.tp);
  const length = c.aspect - 2 * M - 0.06;
  const fitted = fitPlace(upper(c.r.place.name), {
    font: dominantFont(c.family, c.tp, c.r.humidity, size),
    wdthMin: f.wdthMin,
    maxWidth: length,
    minSize: 0.12,
    maxLines: 3,
    measure: c.measure,
  });
  const s = fitted.font.size;
  // Set along the left edge, reading upwards from the foot: turned a quarter, the caps' tops face the margin
  const origin: Point = [M + CAP_HEIGHT * s, bottom];
  const lines = fitted.lines.map((text, i) => ({ text, x: origin[0], y: origin[1] + i * s * 0.92 }));
  const dom: Block = {
    id: "dominant",
    lines,
    widths: lines.map((l) => c.measure(l.text, fitted.font)),
    font: fitted.font,
    rotate: -90 + c.slant,
    origin,
  };
  const box = bounds(dom);
  const right = box.x + box.w;
  // A tall column of map, open at top and foot, over the letters' feet
  const slot = { x: right - CAP_HEIGHT * s * 0.45, y: 0, w: colR(3) - (right - CAP_HEIGHT * s * 0.45), h: c.aspect };
  const reach = (colR(3) - right) / 3;
  return {
    dominant: dom,
    secondary: secondaryTemp(c, 0.13, colX(4) - 0.13 * 0.03, M + CAP_HEIGHT * 0.13),
    slot,
    interplay: "through",
    candidates: feetSpots(c, dom, "right", [reach, reach * 2]),
    weatherAt: { x: colX(4), top: M + CAP_HEIGHT * 0.13 + 0.03 },
    metaAt: { x: colX(4), bottom },
    signatureAt: { x: 1 - M, y: bottom - metaHeight - 0.03, anchor: "end" },
    rail: { x: colX(4) - GUTTER, top: M, bottom },
    numeralWord: false,
  };
}

/** Candidate spots for the city: off each glyph's foot, along the direction the leader runs */
function feetSpots(c: Ctx, b: Block, dir: "down" | "up" | "right", reaches: number[]) {
  const feet = glyphFeet(b, c.measure).filter((g) => g.line === b.lines.length - 1 || dir === "right");
  return feet.flatMap(({ at }) =>
    reaches.map((reach) => {
      const spot: Point =
        dir === "down" ? [at[0], at[1] + reach] : dir === "up" ? [at[0], at[1] - reach] : [at[0] + reach, at[1]];
      return { handle: at, spot, reach };
    }),
  );
}

/* ---------- The crop: where the city lands, scored on what the map then shows ---------- */

const FEATURE_WEIGHT: Record<FeatureKind, number> = { coast: 1, border: 0.7, river: 0.5 };

function ringArea(ring: Point[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function waterShare(placed: Placed, slot: Rect): number {
  const area = placed.water.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
  return clamp(area / (slot.w * slot.h), 0, 1);
}

function scoreCrop(placed: Placed, slot: Rect, dom: Block, reach: number): number {
  const lines = (Object.keys(FEATURE_WEIGHT) as FeatureKind[]).reduce(
    (s, k) => s + FEATURE_WEIGHT[k] * Math.min(featureLength(placed, k), 3 * Math.max(slot.w, slot.h)),
    0,
  );
  // Lines that actually cross the dominant type are the record's interplay
  const cross = baselines(dom).reduce(
    (s, [a, b]) => s + (["coast", "border", "river"] as FeatureKind[]).reduce((n, k) => n + crossings(placed, k, a, b).length, 0),
    0,
  );
  const water = waterShare(placed, slot);
  // Some sea or lake gives the map a shape; a slot drowned in it reads as a blank
  const waterScore = water < 0.08 ? water : water > 0.55 ? 0.55 - (water - 0.55) * 2 : 0.08 + (water - 0.08) * 0.5;
  return lines + Math.min(cross, 6) * 0.15 + waterScore * 2 - reach * 0.5;
}

/* ---------- Nodes ---------- */

const NODE_R = 0.0042;

const LABEL: Record<FeatureKind, string> = { coast: "SHORE", border: "BORDER", river: "RIVER" };

function crossNode(at: Point, text: string): NodePayload {
  return { kind: "node", shape: "cross", at, r: NODE_R * 1.6, label: { text, at: [at[0] + 0.012, at[1] + 0.022], anchor: "start" } };
}

/**
 * The second node, where a line of the map meets the type: on a baseline of the dominant element (the letter stands
 * on the line), else where the city's leader, which hangs from a letter, crosses one. GRID only when the slot has
 * no geography at all; with geography that touches neither, there is no second node rather than a decorative one.
 */
function featureNode(placed: Placed | null, dom: Block, city: Point, handle: Point, measure: Measure): { node: NodePayload; anchor: string } | null {
  const feet = glyphFeet(dom, measure).map((g) => g.at);
  const kinds: FeatureKind[] = ["coast", "border", "river"];
  if (placed) {
    for (const kind of kinds) {
      const hits = baselines(dom)
        .flatMap(([a, b]) => crossings(placed, kind, a, b))
        .filter((p) => Math.hypot(p[0] - city[0], p[1] - city[1]) > 0.06);
      if (!hits.length) continue;
      // The crossing nearest a glyph's foot
      const scored = hits
        .map((p) => ({ p, d: Math.min(...feet.map((f) => Math.hypot(f[0] - p[0], f[1] - p[1]))) }))
        .sort((x, y) => x.d - y.d || x.p[0] - y.p[0] || x.p[1] - y.p[1]);
      return { node: crossNode(scored[0].p, LABEL[kind]), anchor: kind };
    }
    for (const kind of kinds) {
      const hits = crossings(placed, kind, handle, city).filter(
        (p) => Math.hypot(p[0] - city[0], p[1] - city[1]) > 0.03 && Math.hypot(p[0] - handle[0], p[1] - handle[1]) > 0.03,
      );
      if (hits.length) return { node: crossNode(hits[0], LABEL[kind]), anchor: kind };
    }
    if (kinds.some((k) => placed[k].length) || placed.water.length) return null;
  }
  // GRID: the column line nearest the middle of the last baseline
  const [a, b] = baselines(dom)[dom.lines.length - 1];
  const xs = [1, 2, 3, 4, 5].map(colX).filter((x) => x > Math.min(a[0], b[0]) + 0.02 && x < Math.max(a[0], b[0]) - 0.02);
  const horizontal = Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]);
  const at: Point = horizontal && xs.length ? [xs[0], a[1] + ((b[1] - a[1]) * (xs[0] - a[0])) / (b[0] - a[0] || 1)] : feet[0];
  return { node: crossNode(at, "GRID"), anchor: "grid" };
}

/* ---------- Visual thesis ---------- */

/** The feature the map shows most of */
function strongest(placed: Placed | null): string {
  if (!placed) return "grid";
  const kinds: FeatureKind[] = ["coast", "border", "river"];
  const best = kinds.map((k) => ({ k, l: featureLength(placed, k) * FEATURE_WEIGHT[k] })).sort((a, b) => b.l - a.l)[0];
  return best.l > 0 ? best.k : "grid";
}

function thesis(mode: CompositionMode, dominant: Dominant, r: RecordInput, family: ConditionFamily, feature: string): string {
  const name = upper(r.place.name);
  const t = degrees(r.temp);
  const what = feature === "grid" ? "the grid" : feature === "coast" ? "the shoreline" : `the ${feature}`;
  if (mode === "collision")
    return dominant === "temperature" ? `${t} collides with ${what}, which runs in front of its foot` : `${name} is cut by ${what} running through it`;
  if (mode === "open-atlas")
    return dominant === "temperature" ? `${t} floats alone inside a sparse ${family === "SNOW" ? "winter" : "quiet"} map` : `${name} hangs over a quiet map, tied to it by one line`;
  return `${name} rises along ${what}, set to the rhythm of the ${family === "RAIN" ? "rain" : family === "WIND" ? "wind" : "cloud"}`;
}

/* ---------- The composition ---------- */

/**
 * One record's composition, pure: the same input and geography give the same scene. `measure` sets the type's
 * widths (the browser's own layout in the lab and the export, a fixed table in the tests).
 */
export function getRecordComposition(
  r: RecordInput,
  geography: Geography | null,
  measure: Measure,
  canvas: { width: number; height: number } = PRINT,
): RecordScene {
  const family = conditionFamily(r);
  const t = normTemp(r.temp);
  const seed = recordSeed(r.place.name, r.date, family);
  const rng = mulberry32(seed);
  const aspect = canvas.height / canvas.width;
  const metrics = weatherMetrics(family, r);
  const c: Ctx = {
    r,
    family,
    t,
    tp: typePressure(t),
    sc: spaceCompression(t),
    aspect,
    measure,
    slant: windSlant(r.windSpeed, r.windDeg),
    weatherRows: metrics.length,
  };
  const mode = compositionMode(family, r.temp, r.cloudCover);
  const dominant = dominantOf(mode, r.temp);
  const L = mode === "collision" ? collision(c, dominant) : mode === "open-atlas" ? atlas(c, dominant) : vertical(c);
  // Wind leans a horizontal dominant block too, about its first baseline
  if (mode !== "vertical-field" && c.slant) L.dominant.rotate = c.slant;

  // The crop: every candidate spot for the city is tried; the best map wins, the seed only splits a tie
  const spanKm = cropKm(t);
  const city: Point = [r.place.lon, r.place.lat];
  const inSlot = L.candidates.filter(
    ({ spot }) => spot[0] > L.slot.x + 0.03 && spot[0] < L.slot.x + L.slot.w - 0.03 && spot[1] > L.slot.y + 0.03 && spot[1] < L.slot.y + L.slot.h - 0.03,
  );
  const tried = (inSlot.length ? inSlot : L.candidates.slice(0, 1)).map((cand) => {
    const crop: Crop = { slot: L.slot, center: centerFor(city, cand.spot, L.slot, spanKm), spanKm };
    const placed = geography ? placeGeography(geography, crop) : null;
    const score = placed ? scoreCrop(placed, L.slot, L.dominant, cand.reach) : -cand.reach;
    return { cand, crop, placed, score: Math.round(score * 1000) / 1000, tie: rng() };
  });
  tried.sort((a, b) => b.score - a.score || b.tie - a.tie);
  const best = tried[0];
  const placed = best.placed;

  const feature = featureNode(placed, L.dominant, best.cand.spot, best.cand.handle, measure);
  const cityNode: NodePayload = {
    kind: "node",
    shape: "dot",
    at: best.cand.spot,
    r: NODE_R,
    leader: [best.cand.handle, best.cand.spot],
  };

  /* ---------- Layers (sheet units until `toScene`) ---------- */
  const layers: SceneLayer[] = [];
  const add = (l: Omit<SceneLayer, "z">) => layers.push({ ...l, z: Z[l.role] });
  const vis = r.visibility == null ? 1 : lerp(0.65, 1, clamp(r.visibility / 10, 0, 1));
  const slotRect = { kind: "rect" as const, x: L.slot.x, y: L.slot.y, width: L.slot.w, height: L.slot.h };

  add({ id: "paper", role: "paper", inkRole: "paper", opacity: 1, payload: { kind: "rect", x: 0, y: 0, width: 1, height: aspect } });
  // Open atlas keeps its geography to lines: a filled sea there reads as a box on a quiet sheet
  if (placed && mode !== "open-atlas") {
    add({
      id: "water",
      role: "terrain",
      inkRole: "ink-2",
      opacity: 1,
      clip: { rect: L.fillSlot ? { kind: "rect", x: L.fillSlot.x, y: L.fillSlot.y, width: L.fillSlot.w, height: L.fillSlot.h } : slotRect },
      payload: { kind: "paths", paths: placed.water.flat(), closed: true, stroke: 0 },
    });
  }
  const domText = (id: string, b: Block, inkRole: "ink-1" | "accent", role: "type-back" | "type-front"): Omit<SceneLayer, "z"> => ({
    id,
    role,
    inkRole,
    opacity: 1,
    transform: b.rotate ? { rotate: b.rotate, origin: b.origin } : undefined,
    payload: { kind: "text", lines: b.lines, font: b.font, anchor: "start" },
  });
  add(domText("dominant", L.dominant, dominant === "temperature" ? "accent" : "ink-1", "type-back"));

  const lineSets: [FeatureKind, number, number, readonly number[] | undefined][] = [
    ["river", 0.0012, 0.6, undefined],
    ["border", 0.0014, 0.75, [0.007, 0.004]],
    ["coast", 0.0019, 0.92, undefined],
  ];
  if (placed) {
    for (const [kind, stroke, opacity, dash] of lineSets) {
      if (!placed[kind].length) continue;
      const payload = { kind: "paths" as const, paths: placed[kind], closed: false, stroke, dash };
      add({ id: kind, role: "linework", inkRole: "ink-1", opacity: opacity * vis, clip: { rect: slotRect }, payload });
      if (L.interplay === "none") continue;
      // Where a line crosses a letter it is cut out of it in the paper's colour: the map runs through the type
      const band = L.interplay === "interleave" && L.band ? { kind: "rect" as const, x: L.band.x, y: L.band.y, width: L.band.w, height: L.band.h } : slotRect;
      add({
        id: `${kind}-through`,
        role: "linework",
        inkRole: "paper",
        opacity: 1,
        clip: { rect: band, glyphsOf: "dominant" },
        payload: { ...payload, stroke: stroke * 1.25 },
      });
    }
  }

  if (L.secondary)
    add(domText(L.secondary.id, L.secondary, L.secondary.id === "temperature" ? "accent" : "ink-1", "type-front"));

  add({ id: "node-city", role: "nodes", inkRole: "ink-1", opacity: 1, payload: cityNode });
  if (feature) add({ id: `node-${feature.anchor}`, role: "nodes", inkRole: "ink-1", opacity: 0.95, payload: feature.node });

  /* Micro: the weather cluster, the metadata cluster, the signature, archival pairs on the grid */
  const mono = (wght: number, size = MICRO_SIZE, tracking = 0.04): FontRef => ({ family: "mono", wght, wdth: 100, size, tracking });
  const micro = (id: string, lines: TextLine[], font: FontRef, opacity: number, anchor: "start" | "end" = "start", transform?: SceneLayer["transform"]) =>
    add({ id, role: "micro", inkRole: "ink-1", opacity, transform, payload: { kind: "text", lines, font, anchor } });

  const word = upper(CONDITION_WORD[family]);
  const wordFont = clampAxes({ family: "display", wght: 600, wdth: 112, size: 0.026, tracking: 0.12 });
  const valueX = (x: number) => x + COL + GUTTER;
  const rowsFrom = (top: number) => metrics.map((_, i) => top + i * LEAD);
  // The cluster: [numeral], condition word, pairs. Hung from a top, or standing on the bottom margin with its last
  // pair on the same baseline as the metadata's last line
  const WORD_GAP = 0.035;
  const pairTop =
    "top" in L.weatherAt ? L.weatherAt.top + WORD_GAP + LEAD * 0.4 : L.weatherAt.bottom - (metrics.length - 1) * LEAD;
  const weatherTop = "top" in L.weatherAt ? L.weatherAt.top : pairTop - WORD_GAP - LEAD * 0.4;
  if (!("top" in L.weatherAt) && dominant === "place" && !L.secondary) {
    // The temperature over its word, the record's one accent
    const tb = secondaryTemp(c, 0.11, L.weatherAt.x - 0.11 * 0.03, weatherTop - WORD_GAP);
    add(domText("temperature", tb, "accent", "type-front"));
  }
  const wx = L.weatherAt.x;
  micro("condition", [{ text: word, x: wx, y: weatherTop }], wordFont, 1);
  if (L.numeralWord) micro("temperature-word", [{ text: temperatureWords(r.temp), x: valueX(wx), y: weatherTop }], mono(400), 0.7);
  micro("metric-labels", metrics.map((m, i) => ({ text: m.label, x: wx, y: rowsFrom(pairTop)[i] })), mono(400), 0.62);
  micro("metric-values", metrics.map((m, i) => ({ text: m.value, x: valueX(wx), y: rowsFrom(pairTop)[i] })), mono(500), 1);

  const id = recordId(r.place.name, r.date);
  const meta = [
    `${formatCoord(r.place.lat, "lat")} / ${formatCoord(r.place.lon, "lon")}`,
    formatDate(r.date),
    `${r.time} ${r.zone}`,
  ];
  const mb = L.metaAt.bottom;
  const metaLines = meta.map((text, i) => ({ text, x: L.metaAt.x, y: mb - (meta.length - i) * LEAD }));
  const metaTop = metaLines[0].y;
  micro("metadata", metaLines, mono(500), 0.95);
  if (L.rail) {
    // ROTATED MICROTYPE: the record ID climbs the rail
    add({
      id: "rail",
      role: "micro",
      inkRole: "ink-1",
      opacity: 0.4,
      payload: { kind: "paths", paths: [[[L.rail.x, L.rail.top], [L.rail.x, L.rail.bottom]]], closed: false, stroke: 0.0011 },
    });
    micro("record-id", [{ text: id, x: L.rail.x - 0.008, y: L.rail.bottom }], mono(400), 0.62, "start", { rotate: -90, origin: [L.rail.x - 0.008, L.rail.bottom] });
  } else micro("record-id", [{ text: id, x: L.metaAt.x, y: mb }], mono(400), 0.62);

  // The signature, quiet: what (light) weather (heavy)
  // On the metadata's first line when it shares the foot, so a long record ID never runs into it
  const sig = L.rail ? L.signatureAt : { ...L.signatureAt, y: metaTop };
  const sigSize = 0.02;
  const light = clampAxes({ family: "display", wght: 300, wdth: 100, size: sigSize, tracking: -0.01 });
  const heavy = clampAxes({ family: "display", wght: 800, wdth: 100, size: sigSize, tracking: -0.02 });
  const wHeavy = measure("weather", heavy);
  const wLight = measure("what ", light);
  const x0 = sig.anchor === "end" ? sig.x - wHeavy - wLight : sig.x;
  micro("signature-what", [{ text: "what", x: x0, y: sig.y }], light, 0.85);
  micro("signature-weather", [{ text: "weather", x: x0 + wLight, y: sig.y }], heavy, 0.85);

  const scene: RecordScene = {
    canvas: { width: canvas.width, height: canvas.height },
    inks: recordInks(r),
    layers: layers.sort((a, b) => a.z - b.z),
    metadata: {
      mode,
      family,
      dominant,
      interplay: placed ? L.interplay : "none",
      seed,
      visualThesis: thesis(mode, dominant, r, family, feature?.anchor ?? strongest(placed)),
      recordId: id,
      placeFit: L.dominant.id === "dominant" && dominant === "place" ? fitStepOf(c, L) : "temperature",
      nodes: feature ? ["city", feature.anchor] : ["city"],
    },
  };
  return toScene(scene, aspect);
}

function fitStepOf(c: Ctx, L: Layout): string {
  return `${L.dominant.lines.length} line${L.dominant.lines.length > 1 ? "s" : ""}, wdth ${L.dominant.font.wdth}, size ${L.dominant.font.size.toFixed(3)}`;
}

const Z: Record<SceneLayer["role"], number> = {
  paper: 0,
  terrain: 1,
  "type-back": 2,
  linework: 3,
  "type-front": 4,
  nodes: 5,
  micro: 6,
};

/** Sheet units to the scene's normalized space: y over the height */
function toScene(scene: RecordScene, aspect: number): RecordScene {
  const p = ([x, y]: Point): Point => [x, y / aspect];
  const rect = <T extends { y: number; height: number }>(r: T): T => ({ ...r, y: r.y / aspect, height: r.height / aspect });
  return {
    ...scene,
    layers: scene.layers.map((l) => {
      const payload = l.payload;
      const out: SceneLayer = {
        ...l,
        transform: l.transform && { ...l.transform, origin: p(l.transform.origin) },
        clip: l.clip && { ...l.clip, rect: l.clip.rect && rect(l.clip.rect) },
      };
      if (payload.kind === "text") out.payload = { ...payload, lines: payload.lines.map((ln) => ({ ...ln, y: ln.y / aspect })) };
      else if (payload.kind === "paths") out.payload = { ...payload, paths: payload.paths.map((pts) => pts.map(p)) };
      else if (payload.kind === "rect") out.payload = rect(payload);
      else
        out.payload = {
          ...payload,
          at: p(payload.at),
          leader: payload.leader && [p(payload.leader[0]), p(payload.leader[1])],
          label: payload.label && { ...payload.label, at: p(payload.label.at) },
        };
      return out;
    }),
  };
}
