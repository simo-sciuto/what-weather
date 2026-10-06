import { computeAtmosphere } from "@/lib/weather/visual-input";
import { typeVisualState, type TypeSetting, type TypeVisualState } from "@/lib/weather/typography";
import { conditionFamily } from "./condition-family";
import { fitPlace, type Fitted } from "./fit";
import { centerFor, crossings, featureLength, placeGeography, type FeatureKind, type Placed, type Rect } from "./geography";
import { mapInks, recordInks } from "./inks";
import {
  CONDITION_WORD,
  degrees,
  formatCoord,
  formatDate,
  metricsFor,
  recordId,
  temperatureWords,
  type MetricKey,
} from "./metrics";
import { mulberry32, recordSeed } from "./seed";
import { MICRO_SIZE, clampAxes } from "./type-system";
import type {
  CompositionMode,
  FontRef,
  Geography,
  InkRole,
  Measure,
  PathsPayload,
  Point,
  RecordInput,
  RecordScene,
  SceneLayer,
  TextLine,
} from "./types";

/**
 * The composition, after the Type Engine research (2026-10-05): the type engine (`typeVisualState`) reads the
 * atmosphere and decides the mode, the dominant element and how the type is set; the composition lays out the
 * three hand-made posters' structure (Milan, Tshuru, Tokyo) on a six-column grid and lets the geography decide only
 * where the city lands, among a few grid positions, by what the map then shows.
 *
 * Coordinates are written as on the research's 600 x 840 sheet ("reference units") and converted to the scene's
 * sheet units (fractions of the width) here, so the posters stay comparable with the hand-made ones.
 */

export const PRINT = { width: 2480, height: 3508 } as const;

/** The reference sheet */
const REF_W = 600;
const REF_H = 840;
const M = 36;
const COL = [36, 126, 216, 306, 396, 486] as const;
const R = 564;
/** The micro type: 7.5 on the reference sheet, 31 px on the print (`MICRO_SIZE`) */
const MICRO = MICRO_SIZE * REF_W;
const CAP = 0.72;

/** How wide a stretch of ground the sheet's width spans, in km, by mode; the heat tightens it a little */
const SPAN_KM: Record<CompositionMode, number> = { "open-atlas": 170, collision: 110, "field-record": 90 };

type Ref = { x: (v: number) => number; y: (v: number) => number; s: (v: number) => number };

function refUnits(aspect: number): Ref {
  return { x: (v) => v / REF_W, y: (v) => (v / REF_W) * (aspect / (REF_H / REF_W)), s: (v) => v / REF_W };
}

const display = (t: TypeSetting, size: number, tracking = t.tracking): FontRef =>
  clampAxes({ family: "display", wght: t.weight, wdth: t.width, size, tracking });
const mono = (wght: number, size = MICRO): FontRef => ({ family: "mono", wght, wdth: 100, size, tracking: 0.05 });
const upper = (s: string) => s.toLocaleUpperCase("en");

/* ---------- A plan: one candidate composition, in reference units ---------- */

type Text = {
  id: string;
  lines: TextLine[];
  font: FontRef;
  ink: InkRole;
  opacity: number;
  anchor?: "start" | "end";
  rotate?: { deg: number; origin: Point };
  z: SceneLayer["role"];
  /** Drawn as a hole in the map (the temperature) */
  inset?: boolean;
};

type Plan = {
  city: Point;
  texts: Text[];
  /** The dominant numeral's box, for scoring how the map meets it: x0, x1, top, base */
  numeralBox: [number, number, number, number];
  leader: [Point, Point];
  node: "dot" | "triangle";
  coords: Text;
  rules: { from: Point; to: Point; opacity: number }[];
  placeFit: string;
  /** How well the place's name fitted here: 1 at its preferred size */
  fitScore: number;
  /** The hand-made poster's spot for the city */
  preferred: boolean;
  /** Veils of the paper over the map, so the type reads on any street (reference units) */
  shades?: { y0: number; y1: number; from: number; to: number }[];
  /** The map's strong lines run over the large type */
  cut?: boolean;
  /** The home page's wordmark, its baseline's left end and size (reference units) */
  wordmark?: { x: number; y: number; size: number };
};

type Ctx = {
  r: RecordInput;
  tv: TypeVisualState;
  measure: Measure;
  word: string;
  /** The sheet's foot in reference units (840 on the research's ratio) */
  bottom: number;
};

/** Widths in reference units: the engine's measure works in sheet units */
const width = (c: Ctx, text: string, f: FontRef) => c.measure(text, { ...f, size: f.size / REF_W }) * REF_W;

function fitName(c: Ctx, size: number, maxWidth: number, maxLines: number, tracking: number, weight?: number): Fitted {
  const fitted = fitPlace(upper(c.r.place.name), {
    font: display(weight == null ? c.tv.support : { ...c.tv.support, weight }, size / REF_W, tracking),
    wdthMin: 62,
    maxWidth: maxWidth / REF_W,
    minSize: (size * 0.4) / REF_W,
    maxLines,
    measure: c.measure,
  });
  return { ...fitted, font: { ...fitted.font, size: fitted.font.size * REF_W }, width: fitted.width * REF_W };
}

/** An archival pair: a muted label over its value */
const pairs = (id: string, x: number, y: number, label: string, value: string): Text[] => [
  { id: `${id}-label`, lines: [{ text: label, x, y }], font: mono(400), ink: "ink-1", opacity: 0.85, z: "micro" },
  { id: `${id}-value`, lines: [{ text: value, x, y: y + 13 }], font: mono(500), ink: "ink-1", opacity: 1, z: "micro" },
];

const coordsOf = (r: RecordInput) => [formatCoord(r.place.lat, "lat"), formatCoord(r.place.lon, "lon")];
const stamp = (r: RecordInput) => `${r.time} ${r.zone}`;
const conditionFont = (wght: number, wdth: number) => clampAxes({ family: "display", wght, wdth, size: 19, tracking: 3 / 19 });

/** What the foot (atlas), the grid (collision) or the column (field) reports, by family, before the fallbacks */
const FAMILY_ORDER: Record<ReturnType<typeof conditionFamily>, MetricKey[]> = {
  CLEAR: ["uv", "humidity", "wind"],
  CLOUD: ["cloud", "wind", "humidity"],
  FOG: ["visibility", "humidity", "wind"],
  RAIN: ["precip", "wind", "humidity"],
  STORM: ["gust", "precip", "pressure"],
  SNOW: ["precip", "wind", "humidity"],
  WIND: ["wind", "gust", "humidity"],
};

/* ---------- OPEN ATLAS: the temperature large and faded, the place hanging from the city, a line map ---------- */

function atlas(c: Ctx, city: Point, preferred: boolean): Plan {
  const t = c.tv.display;
  const num = degrees(c.r.temp).replace("°", "");
  const unitNum = width(c, num, display(t, 1));
  const unitDeg = width(c, "°", display(t, 1, 0));
  // The engine's scale, unless a long numeral (−24) would leave the sheet: an atlas never bleeds
  const size = Math.min(c.tv.scale * REF_H, (R - 22) / (unitNum + 0.59 * unitDeg));
  const top = 84;
  const degX = 22 + unitNum * size - 0.01 * size;
  const degSize = size * 0.59;
  // A minus is set in front of the map: water laid over the numeral may cover a digit's corner, never the sign
  const minus = num.startsWith("\u2212");
  const minusW = minus ? width(c, "\u2212", display(t, size)) : 0;
  const texts: Text[] = [
    { id: "dominant", lines: [{ text: minus ? num.slice(1) : num, x: 22 + minusW, y: top + CAP * size }], font: display(t, size), ink: "ink-1", opacity: c.tv.tone, z: "type-back" },
    { id: "degree", lines: [{ text: "°", x: degX, y: top + 0.44 * size }], font: display(t, degSize, 0), ink: "ink-1", opacity: c.tv.tone, z: "type-back" },
  ];
  if (minus)
    texts.push({ id: "minus", lines: [{ text: "\u2212", x: 22, y: top + CAP * size }], font: display(t, size), ink: "ink-1", opacity: c.tv.tone, z: "type-front" });
  const wordFont = mono(500, 13);
  const word = temperatureWords(c.r.temp);
  const wordW = width(c, word, wordFont);
  // Under the degree; when a long numeral leaves no room there, under the numeral's foot, flush right
  const beside = degX + unitDeg * degSize * 0.12;
  const wordAt: Point = beside + wordW <= R ? [beside, top + 0.44 * size + 0.22 * degSize + 16] : [R - wordW, top + CAP * size + 26];
  if (c.tv.numeralWord)
    texts.push({ id: "numeral-word", lines: [{ text: word, x: wordAt[0], y: wordAt[1] }], font: wordFont, ink: "ink-1", opacity: 1, z: "type-front" });

  const nameX = city[0] - 3;
  const fitted = fitName(c, 62, R - nameX, 2, 1 / 62);
  const s = fitted.font.size;
  const lines = fitted.lines.map((text, i) => ({ text, x: nameX, y: 700 - (fitted.lines.length - 1 - i) * s * 0.9 }));
  texts.push({ id: "place", lines, font: fitted.font, ink: "ink-1", opacity: 1, z: "type-front" });
  const capTop = lines[0].y - CAP * s;

  texts.push({ id: "condition", lines: [{ text: c.word, x: COL[4], y: 596 }], font: conditionFont(500, 125), ink: "ink-1", opacity: 1, z: "micro" });
  const near = metricsFor(["feels", "range"], c.r, 2, []);
  near.forEach((m, i) => texts.push(...pairs(`near-${i}`, COL[4 + i], 616, m.label, m.value)));
  // The rest of the readings and the moment under them, in the same two columns: no band at the foot
  const more = metricsFor(FAMILY_ORDER[conditionFamily(c.r)], c.r, 3, near.map((m) => m.key));
  const cells: [string, string][] = [...more.map((m): [string, string] => [m.label, m.value]), [formatDate(c.r.date), stamp(c.r)]];
  cells.forEach(([label, value], i) => texts.push(...pairs(`more-${i}`, COL[4 + (i % 2)], 654 + Math.floor(i / 2) * 38, label, value)));
  const [lat, lon] = coordsOf(c.r);
  return {
    city,
    texts,
    numeralBox: [22, degX + unitDeg * degSize, top, top + CAP * size],
    leader: [city, [city[0], capTop - 13]],
    node: "dot",
    coords: { id: "coords", lines: [{ text: `${lat}  ${lon}`, x: city[0] + 9, y: city[1] - 6 }], font: mono(400), ink: "ink-1", opacity: 1, z: "micro" },
    rules: [],
    placeFit: `${fitted.step}, ${fitted.lines.length} line(s), wdth ${fitted.font.wdth}`,
    fitScore: s / 62,
    preferred,
  };
}

/* ---------- COLLISION: the temperature enormous at the foot, through the map; the place heavy at the head ---------- */

function collision(c: Ctx, city: Point, preferred: boolean): Plan {
  const t = c.tv.display;
  const num = degrees(c.r.temp);
  // The engine's size, held so that at least the degree's first half stays on the sheet
  const unitDigits = width(c, num.replace("°", ""), display(t, 1));
  const unitDeg = width(c, "°", display(t, 1));
  const size = Math.min(c.tv.scale * REF_H * (1 + c.tv.bleed), (REF_W - 10) / (unitDigits + 0.5 * unitDeg));
  const base = c.bottom + 0.033 * size;
  const numW = width(c, num, display(t, size));
  const texts: Text[] = [{ id: "dominant", lines: [{ text: num, x: 10, y: base }], font: display(t, size), ink: "ink-1", opacity: c.tv.tone, z: "type-back" }];

  const nameX = city[0] - 4;
  const fitted = fitName(c, 128, 590 - nameX, 3, -1 / 128);
  const s = fitted.font.size;
  const firstBase = 58 + CAP * s;
  const lines = fitted.lines.map((text, i) => ({ text, x: nameX, y: firstBase + i * s * 0.9 }));
  // On the temperature's level, under the map's strong lines: they cross the name as they cross the number
  texts.push({ id: "place", lines, font: fitted.font, ink: "ink-1", opacity: 1, z: "type-back" });
  const lastBase = lines[lines.length - 1].y;

  // The weather beside the name's foot, never under it
  const top = Math.max(204, lastBase + 54);
  texts.push({ id: "condition", lines: [{ text: c.word, x: COL[4], y: top }], font: conditionFont(600, 110), ink: "ink-1", opacity: 1, z: "micro" });
  const ms = metricsFor(["feels", "range", ...FAMILY_ORDER[conditionFamily(c.r)]], c.r, 5, []);
  const cells: [string, string][] = [...ms.map((m): [string, string] => [m.label, m.value]), [formatDate(c.r.date).slice(0, 6), stamp(c.r)]];
  cells.forEach(([label, value], i) => texts.push(...pairs(`cell-${i}`, COL[4 + (i % 2)], top + 20 + Math.floor(i / 2) * 38, label, value)));
  if (c.tv.numeralWord)
    texts.push({
      id: "numeral-word",
      lines: [{ text: temperatureWords(c.r.temp), x: COL[4], y: top + 20 + Math.ceil(cells.length / 2) * 38 + 14 }],
      font: mono(500, 13),
      ink: "ink-1",
      opacity: 1,
      z: "micro",
    });
  const [lat, lon] = coordsOf(c.r);
  return {
    city,
    texts,
    numeralBox: [10, 10 + numW, base - CAP * size, Math.min(base, c.bottom)],
    leader: [[city[0], lastBase + 10], city],
    node: "triangle",
    coords: {
      id: "coords",
      lines: [
        { text: lat, x: city[0] - 10, y: city[1] + 2 },
        { text: lon, x: city[0] - 10, y: city[1] + 12 },
      ],
      font: mono(400),
      ink: "ink-1",
      opacity: 1,
      anchor: "end",
      z: "micro",
    },
    rules: [],
    placeFit: `${fitted.step}, ${fitted.lines.length} line(s), wdth ${fitted.font.wdth}`,
    fitScore: s / 128,
    preferred,
  };
}

/* ---------- FIELD RECORD: the place broken into staggered blocks (MI / LA / NO), the temperature on the last ---------- */

/**
 * The place's name in blocks, one per line: its words when it has several, else its letters in even blocks of two
 * (up to six letters) or three. MILANO is MI LA NO, ULAANBAATAR is ULA ANB AAT AR, RIO DE JANEIRO is three words.
 */
export function nameBlocks(name: string): string[] {
  const words = name.trim().split(/\s+/);
  if (words.length > 1) return words.length <= 4 ? words : [words.slice(0, 2).join(" "), ...words.slice(2)].slice(0, 4);
  const letters = [...words[0]];
  const size = letters.length <= 6 ? 2 : 3;
  const out: string[] = [];
  for (let i = 0; i < letters.length; i += size) out.push(letters.slice(i, i + size).join(""));
  // A last block of one letter joins the one before
  if (out.length > 1 && out[out.length - 1].length === 1 && letters.length > 3) out[out.length - 2] += out.pop();
  return out;
}

function field(c: Ctx, city: Point, preferred: boolean): Plan {
  const blocks = nameBlocks(upper(c.r.place.name));
  const n = blocks.length;
  const texts: Text[] = [];
  // Each line steps right by half a column: the name descends as a stair, the rain's own slant
  const step = (COL[1] - COL[0]) / 2 + 12;
  const lead = 0.86;
  const maxH = c.bottom * 0.58;
  const font0 = display(c.tv.display, 1, -0.02);
  // As large as the width allows (the stair included) and three fifths of the height, never past 230
  const widest = Math.max(...blocks.map((b) => width(c, b, font0)));
  let size = Math.min(230, (R - M - (n - 1) * step) / widest, maxH / (CAP + (n - 1) * lead));
  if (!Number.isFinite(size) || size <= 0) size = 120;
  const f = display(c.tv.display, size, -0.02);
  // Centred on the sheet's height, from the first cap's top to the last baseline
  const first = c.bottom / 2 - ((n - 1) * lead * size - CAP * size) / 2;
  const lines = blocks.map((text, i) => ({ text, x: M - size * 0.04 + i * step, y: first + i * lead * size }));
  lines.forEach((l, i) => texts.push({ id: i ? `place-${i}` : "place", lines: [l], font: f, ink: "ink-1", opacity: c.tv.tone, z: "type-back" }));
  const last = lines[n - 1];
  const lastRight = last.x + width(c, last.text, f);

  // The temperature on the last block's baseline, after it; under it when the line is full
  const num = degrees(c.r.temp);
  let numSize = Math.min(size * 0.62, 200);
  let nf = display(c.tv.support, numSize, -0.02);
  let numX = lastRight + 16;
  let numY = last.y;
  if (numX + width(c, num, nf) > R) {
    numSize = Math.min(numSize, (R - last.x) / Math.max(1e-6, width(c, num, display(c.tv.support, 1, -0.02))));
    nf = display(c.tv.support, numSize, -0.02);
    numX = last.x;
    numY = last.y + CAP * numSize + 24;
  }
  texts.push({ id: "temperature", lines: [{ text: num, x: numX, y: numY }], font: nf, ink: "ink-1", opacity: 1, z: "type-back" });

  texts.push({ id: "condition", lines: [{ text: c.word, x: COL[5], y: 96 }], font: conditionFont(600, 75), ink: "ink-1", opacity: 1, z: "micro" });
  metricsFor([...FAMILY_ORDER[conditionFamily(c.r)], "feels"], c.r, 4, []).forEach((m, i) => texts.push(...pairs(`stack-${i}`, COL[5], 116 + i * 28, m.label, m.value)));
  const [lat, lon] = coordsOf(c.r);
  const firstRight = lines[0].x + width(c, lines[0].text, f);
  return {
    city,
    texts,
    numeralBox: [numX, numX + width(c, num, nf), numY - CAP * numSize, numY],
    // The leader leaves the first block's end and runs right to the city
    leader: [[firstRight + 6, lines[0].y - (CAP * size) / 2], [city[0], lines[0].y - (CAP * size) / 2]],
    node: "dot",
    coords: { id: "coords", lines: [{ text: `${lat}  ${lon}`, x: city[0] + 9, y: city[1] - 6 }], font: mono(400), ink: "ink-1", opacity: 1, z: "micro" },
    rules: [],
    placeFit: `stair, ${n} blocks`,
    fitScore: Math.min(1, size / 150),
    preferred,
  };
}

/* ---------- HOLE: the temperature as a white hole in the map, the name at the foot, the facts in a box ---------- */

/** Where the facts' box may sit on the grid, by its top-left corner, all clear of the temperature: the seed picks one */
const BOX_SLOTS: Point[] = [
  [COL[4], 64],
  [M, 64],
  [COL[2], 64],
];

/**
 * The poster over the site's map (the user's brief of 2026-10-06, WTH-200): the temperature full bleed in white,
 * read as a hole in the map rather than a figure; the place's name large at the foot in the temperature's colour;
 * the map's strong lines over both; the facts in a square box set on the grid; the record's ID and moment up the
 * right edge; the home page's wordmark at the foot.
 */
function hole(c: Ctx, city: Point, preferred: boolean, slot: Point): Plan {
  const texts: Text[] = [];
  const bottom = c.bottom;

  // The temperature across the whole sheet, a little past both edges, centred on the sheet's height
  const num = degrees(c.r.temp);
  const nf0 = display({ weight: 800, width: 100, tracking: -0.04 }, 1, -0.04);
  const unit = width(c, num, nf0);
  const numSize = (REF_W * 1.06) / unit;
  const numX = (REF_W - unit * numSize) / 2;
  const numBase = bottom * 0.56 + (CAP * numSize) / 2;
  texts.push({ id: "dominant", lines: [{ text: num, x: numX, y: numBase }], font: { ...nf0, size: numSize }, ink: "hole", opacity: 1, z: "type-back", inset: true });

  // The name at the foot, as large as the width allows, over the wordmark
  const markBase = bottom - 26;
  const fitted = fitName(c, 92, R - M, 2, -0.02, 800);
  const sz = fitted.font.size;
  const nameBase = markBase - 30;
  const lines = fitted.lines.map((text, i) => ({ text, x: M - sz * 0.03, y: nameBase - (fitted.lines.length - 1 - i) * sz * 0.92 }));
  texts.push({ id: "place", lines, font: fitted.font, ink: "ink-2", opacity: 1, z: "type-back" });

  // The facts, gathered as a square block on the grid (no fill, no border): the condition, four readings, the place's region and country, its coordinates
  const [bx, by] = slot;
  const side = COL[2] - COL[0] - 12;
  const pad = 12;
  const [lat, lon] = coordsOf(c.r);
  texts.push({ id: "condition", lines: [{ text: c.word, x: bx + pad, y: by + pad + 12 }], font: { ...mono(700, 13), tracking: 0.08 }, ink: "ink-1", opacity: 1, z: "micro" });
  const ms = metricsFor(["feels", "range", ...FAMILY_ORDER[conditionFamily(c.r)]], c.r, 4, []);
  const half = (side - 2 * pad) / 2;
  ms.forEach((m, i) => texts.push(...pairs(`metric-${i}`, bx + pad + (i % 2) * half, by + pad + 34 + Math.floor(i / 2) * 34, m.label, m.value)));
  const where = [c.r.place.region, c.r.place.country && upper(c.r.place.country)].filter(Boolean).join(", ");
  const footY = by + side - pad - 13;
  if (where) texts.push({ id: "where", lines: [{ text: where, x: bx + pad, y: footY }], font: mono(700), ink: "ink-2", opacity: 1, z: "micro" });
  texts.push({ id: "coords", lines: [{ text: `${lat}  ${lon}`, x: bx + pad, y: footY + 13 }], font: mono(500), ink: "ink-1", opacity: 0.9, z: "micro" });

  // Up the right edge: the record's ID and its moment
  const edgeAt: Point = [R + 16, nameBase];
  texts.push({
    id: "record-id",
    lines: [{ text: `${recordId(c.r.place.name, c.r.date)}   ${formatDate(c.r.date)}  ${stamp(c.r)}`, x: edgeAt[0], y: edgeAt[1] }],
    font: mono(500, MICRO * 0.85),
    ink: "ink-1",
    opacity: 0.85,
    rotate: { deg: -90, origin: edgeAt },
    z: "micro",
  });
  texts.push({ id: "credits", lines: [{ text: "© MAPBOX © OPENSTREETMAP", x: R, y: markBase }], font: mono(500, MICRO * 0.8), ink: "ink-1", opacity: 0.6, anchor: "end", z: "micro" });

  return {
    city,
    texts,
    numeralBox: [numX, numX + unit * numSize, numBase - CAP * numSize, numBase],
    leader: [city, city],
    node: "dot",
    coords: { id: "city-coords", lines: [], font: mono(500), ink: "ink-1", opacity: 1, z: "micro" },
    rules: [],
    placeFit: `hole, ${fitted.step}, ${fitted.lines.length} line(s)`,
    fitScore: 1,
    preferred,
    cut: true,
    wordmark: { x: M, y: markBase, size: 17 },
    shades: [{ y0: nameBase - fitted.lines.length * sz - 60, y1: bottom, from: 0, to: 0.7 }],
  };
}

/* ---------- Where the city lands ---------- */

/** The grid positions the city may take in each mode; the first is the hand-made poster's */
function citySpots(mode: CompositionMode, c: Ctx): Point[] {
  if (mode === "open-atlas")
    return [
      [216, 600],
      [126, 600],
      [216, 570],
      [126, 570],
    ];
  if (mode === "field-record") {
    // On the first block's middle line, to its right: the leader runs flat from the name to the city
    const probe = field(c, [0, 0], false);
    const [from, to] = probe.leader;
    const y = to[1];
    const xs = [90, 170, 250].map((d) => from[0] + d).filter((x) => x < R - 40);
    return (xs.length ? xs : [R - 40]).map((x): Point => [x, y]);
  }
  // Collision: under the name's last line, which a long name pushes down
  const probe = collision(c, [126, 330], false);
  const last = probe.texts.find((t) => t.id === "place")!.lines.at(-1)!.y;
  const y = Math.max(330, last + 150);
  return [
    [126, y],
    [216, y],
    [126, y + 40],
    [216, y + 40],
  ];
}

const FEATURE_WEIGHT: Record<FeatureKind, number> = { coast: 1, border: 0.6, river: 0.5 };

function ringArea(ring: Point[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** How much of the sheet is water, 0..1 */
function waterShare(placed: Placed, sheet: Rect): number {
  const area = placed.water.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
  return Math.min(1, Math.max(0, area / (sheet.w * sheet.h)));
}

/**
 * A candidate's score: how much geography the sheet shows, how many shores and borders cross the dominant numeral
 * (the record's interplay), a share of water that gives the map a shape without drowning it, how well the name
 * fits, and a small preference for the hand-made poster's spot.
 */
function score(placed: Placed | null, box: [number, number, number, number], sheet: Rect, plan: Plan, mode: CompositionMode): number {
  let s = plan.fitScore * 1.5 + (plan.preferred ? 0.3 : 0);
  if (!placed) return s;
  s += (Object.keys(FEATURE_WEIGHT) as FeatureKind[]).reduce((n, k) => n + FEATURE_WEIGHT[k] * Math.min(featureLength(placed, k), 4), 0) * 0.3;
  const [x0, x1, top, base] = box;
  let cross = 0;
  for (const f of [0.25, 0.5, 0.75]) {
    const y = top + (base - top) * f;
    for (const k of ["coast", "border"] as FeatureKind[]) cross += crossings(placed, k, [Math.max(0, x0), y], [Math.min(1, x1), y]).length;
  }
  s += Math.min(cross, 8) * 0.2;
  const water = waterShare(placed, sheet);
  const want = mode === "open-atlas" ? 0.15 : 0.35;
  return s - Math.abs(water - want) * (mode === "open-atlas" ? 0.5 : 1.5);
}

/* ---------- The composition ---------- */

/**
 * One record's composition, pure: the same input and geography give the same scene for the same type measure
 * (the browser's own layout in the lab and the export, a fixed table in the tests).
 */
export function getRecordComposition(
  r: RecordInput,
  geography: Geography | null,
  measure: Measure,
  canvas: { width: number; height: number } = PRINT,
  /**
   * "vector": the geography given is drawn by the engine (the research's line maps). "raster": the poster's own map
   * is drawn elsewhere (Mapbox, the site's style) and handed to the renderer as two pictures, "map" (the whole map)
   * and "map-cut" (its strongest lines alone, in their colours over a shadow): the scene says where they go.
   */
  map: "vector" | "raster" = "vector",
): RecordScene {
  if (!r.place.name.trim()) throw new Error("A record needs a place name");
  const raster = map === "raster";
  if (raster) geography = null;
  const aspect = canvas.height / canvas.width;
  const ref = refUnits(aspect);
  // The foot in reference units: `ref.y` already stretches the 840 of the research's sheet to this sheet's height
  const bottom = REF_H;
  const { atmosphere } = computeAtmosphere({
    light: r.light ?? 0.5,
    temp: r.temp,
    condition: r.condition,
    intensity: r.intensity,
    cloudCover: r.cloudCover,
    humidity: r.humidity,
    visibility: r.visibility,
    precipitation: r.precipitation,
    uvIndex: r.uv,
  });
  const tv = typeVisualState(atmosphere);
  // Over the site's map every record takes the Tshuru structure (the user's choice, 2026-10-06): the name heavy at
  // the head, the temperature huge at the foot; the atmosphere moves its type, scale, bleed and tone
  const mode = tv.mode;
  const family = conditionFamily(r);
  const seed = recordSeed(r.place.name, r.date, family);
  const rng = mulberry32(seed);
  const c: Ctx = { r, tv, measure, word: CONDITION_WORD[family], bottom };
  const build = (city: Point, preferred: boolean) =>
    raster ? hole(c, city, preferred, BOX_SLOTS[seed % BOX_SLOTS.length]) : mode === "open-atlas" ? atlas(c, city, preferred) : mode === "collision" ? collision(c, city, preferred) : field(c, city, preferred);

  // The map spans the whole sheet and a little more, so its fills and lines leave by the edges
  const bleed = 20;
  const sheet: Rect = { x: ref.x(-bleed), y: ref.y(-bleed), w: ref.x(REF_W + 2 * bleed), h: ref.y(bottom + 2 * bleed) };
  // The span is of the sheet's width; the slot is a little wider
  const spanKm = SPAN_KM[mode] * (1 - 0.15 * Math.max(0, atmosphere.warmth)) * sheet.w;
  const place: Point = [r.place.lon, r.place.lat];
  // The seed's one choice over the map: the structure as drawn, or mirrored (name flush right, the number leaving
  // by the right edge); both are the same record's equals, neither is the weather's
  const mirrored = false;
  // Over the map the city sits a little above the middle, as on the poster before the records, clear of the foot
  const spots: Point[] = raster ? [[REF_W / 2, REF_H * 0.4]] : citySpots(mode, c);
  const tried = spots.map((spot, i) => {
    const plan = mirrored ? mirrorPlan(build(spot, i === 0), c) : build(spot, i === 0);
    const crop = { slot: sheet, center: centerFor(place, [ref.x(plan.city[0]), ref.y(plan.city[1])], sheet, spanKm), spanKm };
    const placed = geography ? placeGeography(geography, crop) : null;
    const b = plan.numeralBox;
    const s = score(placed, [ref.x(b[0]), ref.x(b[1]), ref.y(b[2]), ref.y(b[3])], sheet, plan, mode);
    return { plan, placed, score: Math.round(s * 1000) / 1000, tie: rng() };
  });
  tried.sort((a, b) => b.score - a.score || b.tie - a.tie);
  const { plan, placed } = tried[0];

  /* ---------- Layers ---------- */
  const layers: SceneLayer[] = [];
  const Z: Record<SceneLayer["role"], number> = { paper: 0, terrain: 1, "type-back": 2, linework: 3, "type-front": 4, nodes: 5, micro: 6 };
  let order = 0;
  const add = (l: Omit<SceneLayer, "z">) => layers.push({ ...l, z: Z[l.role] + order++ / 1000 });
  // The scene's space is normalized: y over the height. The plan is in reference units, the map in sheet units
  const N = (p: Point): Point => [p[0], p[1] / aspect];
  const P = (p: Point): Point => N([ref.x(p[0]), ref.y(p[1])]);
  const inks = raster ? mapInks(r.light ?? 0.5, atmosphere, r.temp) : recordInks(atmosphere);
  const text = (t: Text) => {
    add({
      id: t.id,
      role: t.z,
      inkRole: t.ink,
      inset: t.inset,
      opacity: t.opacity,
      transform: t.rotate && { rotate: t.rotate.deg, origin: P(t.rotate.origin) },
      payload: {
        kind: "text",
        lines: t.lines.map((l) => ({ ...l, x: ref.x(l.x), y: ref.y(l.y) / aspect })),
        font: clampAxes({ ...t.font, size: ref.s(t.font.size) }),
        anchor: t.anchor ?? "start",
      },
    });
  };
  // The home page's wordmark (`Wordmark.tsx`): "what" light, a short butter bar low like a horizon, "weather" black
  const wordmark = ({ x, y, size }: { x: number; y: number; size: number }) => {
    const light: FontRef = { family: "brand", wght: 300, wdth: 100, size, tracking: -0.02 };
    const heavy: FontRef = { family: "brand", wght: 800, wdth: 100, size, tracking: -0.05 };
    const wWhat = width(c, "what", light);
    text({ id: "wordmark-what", lines: [{ text: "what", x, y }], font: light, ink: "ink-1", opacity: 1, z: "micro" });
    const barX = x + wWhat + 0.08 * size;
    const [bx0, by0] = [ref.x(barX), ref.y(y - 0.12 * size - 0.09 * size)];
    add({ id: "wordmark-bar", role: "micro", inkRole: "brand", opacity: 1, payload: { kind: "rect", x: bx0, y: by0 / aspect, width: ref.s(0.34 * size), height: ref.s(0.09 * size) / aspect } });
    text({ id: "wordmark-weather", lines: [{ text: "weather", x: barX + 0.42 * size, y }], font: heavy, ink: "ink-1", opacity: 1, z: "micro" });
  };
  const lines = (id: string, role: SceneLayer["role"], ink: InkRole, opacity: number, paths: Point[][], strokeRef: number, extra: Partial<PathsPayload> = {}) => {
    if (paths.length) add({ id, role, inkRole: ink, opacity, payload: { kind: "paths", paths: paths.map((l) => l.map(N)), closed: false, stroke: ref.s(strokeRef), ...extra } });
  };

  add({ id: "paper", role: "paper", inkRole: "paper", opacity: 1, payload: { kind: "rect", x: 0, y: 0, width: 1, height: aspect } });
  const water = placed ? placed.water.flat() : [];
  // The poster's own map: the whole sheet, no head or foot band
  const band = { kind: "rect" as const, x: 0, y: 0, width: 1, height: 1 };
  if (raster) add({ id: "map", role: "terrain", inkRole: "ink-1", opacity: 1, clip: { rect: band }, payload: { kind: "image", key: "map", x: 0, y: 0, width: 1, height: 1 } });
  // The classic poster's veils of the sky over the map, under the head and at the foot
  plan.shades?.forEach((v, i) =>
    add({ id: `shade-${i}`, role: "terrain", inkRole: "paper", opacity: 1, payload: { kind: "shade", x: 0, y: ref.y(v.y0) / aspect, width: 1, height: (ref.y(v.y1) - ref.y(v.y0)) / aspect, from: v.from, to: v.to } }),
  );

  if (mode !== "open-atlas" && placed) {
    // Cobalt water under everything, rivers faint under the type
    if (water.length) add({ id: "water", role: "terrain", inkRole: "ink-2", opacity: 1, payload: { kind: "paths", paths: water.map((l) => l.map(N)), closed: true, stroke: 0 } });
    lines("river", "terrain", "ink-1", mode === "collision" ? 0.5 : 0.4, placed.river, 0.8);
  }
  const sheetPoint = (p: Point): Point => [ref.x(p[0]), ref.y(p[1])];
  // The field record's rails stand behind the type; the atlas's foot rule is part of the micro type, over the map
  const rule = (i: number, r: Plan["rules"][number], role: SceneLayer["role"]) =>
    lines(`rule-${i}`, role, "ink-1", r.opacity, [[sheetPoint(r.from), sheetPoint(r.to)]], role === "micro" ? 0.75 : 0.6);
  if (mode === "field-record") plan.rules.forEach((r, i) => rule(i, r, "terrain"));

  // The dominant type, set behind the map
  const back = plan.texts.filter((t) => t.z === "type-back");
  for (const t of back) text(t);

  if (raster && plan.cut)
    // THROUGH on the real map: its strongest lines (motorways, main roads, railways, rivers, shores) cut the type
    add({
      id: "map-cut",
      role: "linework",
      inkRole: "paper",
      opacity: 1,
      clip: { rect: band, glyphsOf: back.map((t) => t.id) },
      payload: { kind: "image", key: "map-cut", x: 0, y: 0, width: 1, height: 1 },
    });

  if (placed) {
    if (mode === "open-atlas") {
      // A line map: faint rivers, dotted borders, the water laid over the numeral in the paper's colour, shores in ink
      lines("river", "linework", "ink-1", 0.3, placed.river, 0.7);
      lines("border", "linework", "ink-1", 0.7, placed.border, 0.8, { dash: [ref.s(1), ref.s(3)] });
      // INTERLEAVE never hides more than about 30% of the numeral: a sea that would is left under it, its shore drawn
      if (water.length && waterOver(placed, plan.numeralBox.map((v, i) => (i < 2 ? ref.x(v) : ref.y(v))) as Plan["numeralBox"]) <= 0.3)
        add({ id: "water", role: "linework", inkRole: "paper", opacity: 1, payload: { kind: "paths", paths: water.map((l) => l.map(N)), closed: true, stroke: 0 } });
      lines("coast", "linework", "ink-1", 1, placed.coast, 0.9);
    } else {
      // THROUGH: the shores and borders cross the type in the paper's colour
      lines("coast", "linework", "paper", 1, placed.coast, mode === "collision" ? 2.4 : 2);
      lines("border", "linework", "paper", 1, placed.border, 1.1, { dash: [ref.s(5), ref.s(4)] });
    }
  }

  for (const t of plan.texts.filter((t) => t.z === "type-front")) text(t);

  // The city: the record's one accent, tied to the name by a hairline
  const [l0, l1] = plan.leader;
  if (l0[0] !== l1[0] || l0[1] !== l1[1]) lines("leader", "nodes", "ink-1", 1, [[sheetPoint(l0), sheetPoint(l1)]], 0.75);
  add({ id: "node-city", role: "nodes", inkRole: "accent", opacity: 1, payload: { kind: "node", shape: plan.node, at: P(plan.city), r: ref.s(plan.node === "dot" ? 4.2 : 6) } });
  if (plan.coords.lines.length) text(plan.coords);

  if (mode !== "field-record" || raster) plan.rules.forEach((r, i) => rule(i, r, "micro"));
  for (const t of plan.texts.filter((t) => t.z === "micro")) text(t);
  if (plan.wordmark) wordmark(plan.wordmark);
  const id = recordId(r.place.name, r.date);
  // The vector records' notes, flat along the top; the classic poster over the map sets its own head and foot
  if (!raster) {
    const noteFont = mono(400, MICRO * 0.85);
    text({
      id: "record-id",
      lines: [
        { text: id, x: M, y: 30 },
        { text: `${formatDate(r.date)}  ${stamp(r)}`, x: M, y: 42 },
      ],
      font: noteFont,
      ink: "ink-1",
      opacity: 1,
      z: "micro",
    });
    text({ id: "signature", lines: [{ text: "WHAT WEATHER", x: R, y: 30 }], font: noteFont, ink: "ink-1", opacity: 0.85, anchor: "end", z: "micro" });
  }

  return {
    canvas: { width: canvas.width, height: canvas.height },
    inks,
    layers: layers.sort((a, b) => a.z - b.z),
    metadata: {
      mode,
      family,
      dominant: tv.dominant,
      interplay: raster ? "through" : !placed ? "none" : mode === "open-atlas" ? "interleave" : "through",
      seed,
      visualThesis: thesis(mode, tv.dominant, r, placed),
      recordId: id,
      placeFit: plan.placeFit,
      nodes: ["city"],
      cityAt: P(plan.city),
      spanKm: spanKm / sheet.w,
      type: tv,
    },
  };
}

/** A plan reflected left to right on the reference sheet: each line keeps its own reading order */
function mirrorPlan(plan: Plan, c: Ctx): Plan {
  const mx = (x: number) => REF_W - x;
  // Small type turns flush right at the mirrored point (and back); large type keeps reading from its left edge,
  // moved across by its own width
  const flip = (t: Text): Text => {
    const mono = t.font.family === "mono";
    if (mono) return { ...t, anchor: t.anchor === "end" ? "start" : "end", lines: t.lines.map((l) => ({ ...l, x: mx(l.x) })) };
    return { ...t, lines: t.lines.map((l) => ({ ...l, x: mx(l.x) - width(c, l.text, t.font) })) };
  };
  const [x0, x1, top, base] = plan.numeralBox;
  return {
    ...plan,
    city: [mx(plan.city[0]), plan.city[1]],
    texts: plan.texts.map(flip),
    coords: flip(plan.coords),
    leader: [
      [mx(plan.leader[0][0]), plan.leader[0][1]],
      [mx(plan.leader[1][0]), plan.leader[1][1]],
    ],
    numeralBox: [mx(x1), mx(x0), top, base],
    rules: plan.rules.map((r) => ({ ...r, from: [mx(r.from[0]), r.from[1]], to: [mx(r.to[0]), r.to[1]] })),
  };
}

/** The share of a box (sheet units) that water covers, sampled on a grid */
function waterOver(placed: Placed, [x0, x1, top, base]: Plan["numeralBox"]): number {
  let hit = 0;
  const n = 12;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p: Point = [x0 + ((x1 - x0) * (i + 0.5)) / n, top + ((base - top) * (j + 0.5)) / n];
      if (placed.water.some((poly) => inside(p, poly))) hit++;
    }
  return hit / (n * n);
}

/** Even-odd point in polygon (rings) */
function inside(p: Point, rings: Point[][]): boolean {
  let hit = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
  return hit;
}

function thesis(mode: CompositionMode, dominant: "temperature" | "place", r: RecordInput, placed: Placed | null): string {
  const t = degrees(r.temp);
  const name = upper(r.place.name);
  const what = !placed ? "an empty grid" : placed.coast.length ? "the shore" : placed.border.length ? "a border" : "the rivers";
  if (mode === "open-atlas") return `${t} fades into the paper, ${what} laid over it; ${name} hangs from the city`;
  if (mode === "collision") return `${t} fills the foot of the sheet and ${what} cuts through it`;
  return dominant === "place" ? `${name} stands as a column on the grid's rails, ${what} crossing ${t}` : `${t} beside the column of ${name}`;
}
