import type { Geography, LonLat, Point } from "./types";

/**
 * Geography placed on the sheet. Works in "sheet units": x and y both in fractions of the sheet's width, so
 * distances are true; the composition divides y by the sheet's height ratio when it writes the scene.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type Crop = {
  /** Where the map is drawn, sheet units */
  slot: Rect;
  /** The place on the ground at the slot's centre */
  center: LonLat;
  /** The slot's width, in km */
  spanKm: number;
};

export type FeatureKind = "coast" | "border" | "river";

export type Placed = {
  coast: Point[][];
  border: Point[][];
  river: Point[][];
  water: Point[][][];
};

const KM_PER_DEG_LAT = 110.57;
const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Ground to sheet: a local equirectangular projection around the crop's centre, true enough at a few hundred km */
export function projector(crop: Crop): (p: LonLat) => Point {
  const kmPerUnit = crop.spanKm / crop.slot.w;
  const [lon0, lat0] = crop.center;
  const kx = kmPerDegLon(lat0);
  const cx = crop.slot.x + crop.slot.w / 2;
  const cy = crop.slot.y + crop.slot.h / 2;
  return ([lon, lat]) => [cx + ((lon - lon0) * kx) / kmPerUnit, cy - ((lat - lat0) * KM_PER_DEG_LAT) / kmPerUnit];
}

/** Sheet to ground: where the crop must be centred for `place` to land on `at` */
export function centerFor(place: LonLat, at: Point, slot: Rect, spanKm: number): LonLat {
  const kmPerUnit = spanKm / slot.w;
  const dxKm = (at[0] - (slot.x + slot.w / 2)) * kmPerUnit;
  const dyKm = (at[1] - (slot.y + slot.h / 2)) * kmPerUnit;
  return [place[0] - dxKm / kmPerDegLon(place[1]), place[1] + dyKm / KM_PER_DEG_LAT];
}

/** Liang-Barsky: the part of a-b inside the rectangle */
function clipSegment(a: Point, b: Point, r: Rect): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (const [p, q] of [
    [-dx, a[0] - r.x],
    [dx, r.x + r.w - a[0]],
    [-dy, a[1] - r.y],
    [dy, r.y + r.h - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 > t1) return null;
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

export function clipLine(line: Point[], r: Rect): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] | null = null;
  for (let i = 1; i < line.length; i++) {
    const seg = clipSegment(line[i - 1], line[i], r);
    if (!seg) {
      run = null;
      continue;
    }
    const last = run?.at(-1);
    if (!run || !last || last[0] !== seg[0][0] || last[1] !== seg[0][1]) {
      run = [seg[0]];
      runs.push(run);
    }
    run.push(seg[1]);
    if (seg[1][0] !== line[i][0] || seg[1][1] !== line[i][1]) run = null;
  }
  return runs.filter((l) => l.length > 1);
}

/** Sutherland-Hodgman against the rectangle */
export function clipRing(ring: Point[], r: Rect): Point[] {
  const at = (a: Point, b: Point, axis: 0 | 1, v: number): Point => {
    const t = (v - a[axis]) / (b[axis] - a[axis]);
    return axis === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v];
  };
  const sides: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p[0] >= r.x, (a, b) => at(a, b, 0, r.x)],
    [(p) => p[0] <= r.x + r.w, (a, b) => at(a, b, 0, r.x + r.w)],
    [(p) => p[1] >= r.y, (a, b) => at(a, b, 1, r.y)],
    [(p) => p[1] <= r.y + r.h, (a, b) => at(a, b, 1, r.y + r.h)],
  ];
  let out = ring;
  for (const [inside, cross] of sides) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
    if (!out.length) return [];
  }
  return out;
}

/** Drops points closer than `min` to the last kept, keeping both ends */
function thin(points: Point[], min: number): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i][0] - last[0], points[i][1] - last[1]) >= min) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** The geography in the slot: projected, cut at the slot's edges, thinned to what the sheet can show */
export function placeGeography(geo: Geography, crop: Crop): Placed {
  const project = projector(crop);
  const min = 0.0006;
  const lines = (ls: LonLat[][]) =>
    ls.flatMap((l) => clipLine(l.map(project), crop.slot)).map((l) => thin(l, min)).filter((l) => l.length > 1);
  return {
    coast: lines(geo.coast),
    border: lines(geo.border),
    river: lines(geo.river),
    water: geo.water
      .map((poly) => poly.map((ring) => thin(clipRing(ring.map(project), crop.slot), min)).filter((r) => r.length > 2))
      .filter((poly) => poly.length > 0),
  };
}

export const lineLength = (l: Point[]) => l.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);

/** How much of a kind of feature the slot shows, in sheet units of line */
export function featureLength(placed: Placed, kind: FeatureKind): number {
  return placed[kind].reduce((s, l) => s + lineLength(l), 0);
}

/** Where a line of the map crosses segment a-b (a glyph's baseline, a scan line across the type) */
export function crossings(placed: Placed, kind: FeatureKind, a: Point, b: Point): Point[] {
  const out: Point[] = [];
  const [x1, y1] = a;
  const [x2, y2] = b;
  for (const line of placed[kind])
    for (let i = 1; i < line.length; i++) {
      const [x3, y3] = line[i - 1];
      const [x4, y4] = line[i];
      const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(d) < 1e-12) continue;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
    }
  return out;
}
