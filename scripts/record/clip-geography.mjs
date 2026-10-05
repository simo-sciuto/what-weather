#!/usr/bin/env node
/**
 * Cuts the Natural Earth 10m layers (public domain, naturalearthdata.com) down to the box around each spike
 * record, so the Visual Record spike (WTH-187) has real vector geography without a Mapbox token.
 *
 *   node scripts/record/clip-geography.mjs <folder with the ne_10m_*.geojson files>
 *
 * Writes src/lib/record/fixtures/geography/<slug>.json: { coast (sea and lake shores), border, river: lines;
 * water: polygons },
 * each point [lon, lat] to four decimals. Lines are cut at the box; polygons are clipped to it.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const PLACES = [
  ["tshuru", -4.4667, 29.1],
  ["milan", 45.4642, 9.19],
  ["tokyo", 35.6812, 139.7671],
  ["reykjavik", 64.1466, -21.9426],
  ["cairo", 30.0444, 31.2357],
  ["ulaanbaatar", 47.9184, 106.9177],
  ["oslo", 59.9139, 10.7522],
  ["san-cristobal-de-las-casas", 16.737, -92.6376],
];
/** Half the box's side, in km: the widest crop (420 km on its long side) with room to move off centre */
const HALF_KM = 320;

const dir = process.argv[2];
if (!dir) throw new Error("Pass the folder of the Natural Earth GeoJSON files");
const load = (name) => {
  try {
    return JSON.parse(readFileSync(join(dir, `${name}.geojson`), "utf8")).features;
  } catch {
    console.warn(`skipped ${name}`);
    return [];
  }
};

const lakes = [...load("ne_10m_lakes"), ...load("ne_10m_lakes_europe")];
/** A lake's shore is a coast too: its rings become lines, cut at the box like the rest */
const shores = lakes.flatMap((f) =>
  polygonsOf(f.geometry).flatMap((poly) => poly.map((ring) => ({ geometry: { type: "LineString", coordinates: ring } }))),
);

const layers = {
  coast: [...load("ne_10m_coastline"), ...shores],
  border: load("ne_10m_admin_0_boundary_lines_land"),
  river: [...load("ne_10m_rivers_lake_centerlines"), ...load("ne_10m_rivers_europe")],
  water: [...load("ne_10m_ocean"), ...lakes],
};

const q = (v) => Math.round(v * 1e4) / 1e4;

function linesOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}
function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/** Liang-Barsky: the part of segment a-b inside the box, or null */
function clipSegment(a, b, box) {
  let [t0, t1] = [0, 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const edges = [
    [-dx, a[0] - box.w],
    [dx, box.e - a[0]],
    [-dy, a[1] - box.s],
    [dy, box.n - a[1]],
  ];
  for (const [p, r] of edges) {
    if (p === 0) {
      if (r < 0) return null;
    } else {
      const t = r / p;
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

function clipLine(line, box) {
  const runs = [];
  let run = null;
  for (let i = 1; i < line.length; i++) {
    const seg = clipSegment(line[i - 1], line[i], box);
    if (!seg) {
      run = null;
      continue;
    }
    const continues = run && run.at(-1)[0] === seg[0][0] && run.at(-1)[1] === seg[0][1];
    if (!continues) {
      run = [seg[0]];
      runs.push(run);
    }
    run.push(seg[1]);
    // Cut where the segment leaves the box
    if (seg[1][0] !== line[i][0] || seg[1][1] !== line[i][1]) run = null;
  }
  return runs.filter((r) => r.length > 1);
}

/** Sutherland-Hodgman against the four sides of the box */
function clipRing(ring, box) {
  const sides = [
    [(p) => p[0] >= box.w, (a, b) => at(a, b, 0, box.w)],
    [(p) => p[0] <= box.e, (a, b) => at(a, b, 0, box.e)],
    [(p) => p[1] >= box.s, (a, b) => at(a, b, 1, box.s)],
    [(p) => p[1] <= box.n, (a, b) => at(a, b, 1, box.n)],
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
function at(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v];
}

/** Drops points closer than `min` degrees to the last one kept, keeping the ends */
function thin(points, min) {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out.at(-1);
    if (Math.hypot(points[i][0] - last[0], points[i][1] - last[1]) >= min) out.push(points[i]);
  }
  out.push(points.at(-1));
  return out.map(([x, y]) => [q(x), q(y)]);
}

const outDir = "src/lib/record/fixtures/geography";
mkdirSync(outDir, { recursive: true });

for (const [slug, lat, lon] of PLACES) {
  const dLat = HALF_KM / 110.57;
  const dLon = HALF_KM / (111.32 * Math.cos((lat * Math.PI) / 180));
  const box = { s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon };
  const min = 0.25 / 110.57; // about 250 m
  const out = { coast: [], border: [], river: [], water: [] };
  for (const kind of ["coast", "border", "river"])
    for (const f of layers[kind])
      for (const line of linesOf(f.geometry))
        for (const run of clipLine(line, box)) out[kind].push(thin(run, min));
  for (const f of layers.water)
    for (const poly of polygonsOf(f.geometry)) {
      const rings = poly.map((r) => clipRing(r, box)).filter((r) => r.length > 2);
      if (rings.length) out.water.push(rings.map((r) => thin(r, min)));
    }
  writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(out));
  const n = (k) => out[k].reduce((s, l) => s + (k === "water" ? l.flat().length : l.length), 0);
  console.log(slug, { coast: n("coast"), border: n("border"), river: n("river"), water: n("water") });
}
