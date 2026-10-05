import type { CloudGrid } from "./cloud-grid";

/**
 * Paints a cloud grid at a moment (`t`, fractional hours from the first
 * frame) onto a canvas the map lays over the grid's area. Between the grid
 * points the values are interpolated (bilinear in space, linear in time), so
 * clouds drift smoothly rather than jump from hour to hour; a fixed grain
 * breaks them into masses, and the edges fade so the grid has no border.
 */

/** Canvas pixels between two grid points: enough for soft shapes, cheap enough for every frame. */
export const CLOUD_CELL_PX = 28;

/** How clouds and rain look: their colours and their strongest opacity (0..1). */
export type CloudPalette = {
  cloud: readonly [number, number, number];
  rain: readonly [number, number, number];
  cloudAlpha: number;
  rainAlpha: number;
};

/**
 * Ice-white clouds (a cool white: a warm one turns to mud grey on a dark map) and a soft sky-blue rain:
 * light enough to show on a dark map, faint enough to read it through.
 */
export const CLOUD_PALETTE: CloudPalette = {
  cloud: [228, 236, 255],
  rain: [146, 196, 246],
  cloudAlpha: 0.3,
  rainAlpha: 0.45,
};

/**
 * A smooth, tileable value noise, built once and equalized: its values are
 * spread evenly over 0..1, so "the brightest 30% of the noise" is exactly 30%
 * of the area. That lets cloud cover decide how much of the map is covered.
 */
function makeGrain(size: number, seed = 11): Float32Array {
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(size * size);
  // Three octaves of smoothed lattice noise: the masses, then finer edges
  for (const [cells, weight] of [
    [4, 0.55],
    [8, 0.3],
    [16, 0.15],
  ] as const) {
    const lattice = Array.from({ length: cells * cells }, rand);
    const at = (x: number, y: number) => lattice[((y + cells) % cells) * cells + ((x + cells) % cells)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        // Quintic fade: the lattice's squares don't show through, even cut by a threshold
        const sx = quintic(fx - x0);
        const sy = quintic(fy - y0);
        const top = lerp(at(x0, y0), at(x0 + 1, y0), sx);
        const bottom = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx);
        out[y * size + x] += lerp(top, bottom, sy) * weight;
      }
    }
  }
  // A light blur rounds what's left of the lattice
  for (let pass = 0; pass < 2; pass++) blurWrap(out, size, 2);
  // Equalize: each value becomes its rank
  const order = Array.from(out.keys()).sort((i, j) => out[i] - out[j]);
  const ranked = new Float32Array(out.length);
  order.forEach((i, rank) => (ranked[i] = rank / (out.length - 1)));
  return ranked;
}

/** Box blur in place, both directions, wrapping around the tile's edges. */
function blurWrap(v: Float32Array, size: number, r: number) {
  const tmp = new Float32Array(v.length);
  for (const horizontal of [true, false]) {
    for (let a = 0; a < size; a++) {
      for (let b = 0; b < size; b++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) {
          const c = (b + k + size) % size;
          sum += horizontal ? v[a * size + c] : v[c * size + a];
        }
        tmp[horizontal ? a * size + b : b * size + a] = sum / (2 * r + 1);
      }
    }
    v.set(tmp);
  }
}

const quintic = (f: number) => f * f * f * (f * (f * 6 - 15) + 10);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const smooth = (f: number) => f * f * (3 - 2 * f);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)));

const GRAIN_SIZE = 128;
let grain: Float32Array | null = null;

/** The grain at a fractional position, interpolated, wrapping around: smooth at any `detail`. */
function grainAt(g: Float32Array, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (xi: number, yi: number) => g[(((yi % GRAIN_SIZE) + GRAIN_SIZE) % GRAIN_SIZE) * GRAIN_SIZE + (((xi % GRAIN_SIZE) + GRAIN_SIZE) % GRAIN_SIZE)];
  return lerp(lerp(at(x0, y0), at(x0 + 1, y0), fx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx), fy);
}

/** A stretch of the map in degrees; the canvas covers exactly this. */
export type CloudArea = {
  west: number;
  east: number;
  north: number;
  south: number;
};

/** The whole grid. */
export function gridArea(grid: CloudGrid): CloudArea {
  return { west: grid.lons[0], east: grid.lons[grid.lons.length - 1], north: grid.lats[0], south: grid.lats[grid.lats.length - 1] };
}

/** A box of the given half-size (degrees) around a point: for a map zoomed in on a city. */
export function areaAround(lat: number, lon: number, halfLat: number, halfLon: number): CloudArea {
  return { west: lon - halfLon, east: lon + halfLon, north: lat + halfLat, south: lat - halfLat };
}

/** One canvas pixel per CLOUD_CELL_PX-th of a grid step across the whole grid. */
export function canvasSize(grid: CloudGrid) {
  return { width: (grid.lons.length - 1) * CLOUD_CELL_PX + 1, height: (grid.lats.length - 1) * CLOUD_CELL_PX + 1 };
}

/** The canvas corners on the map, [lon, lat]: top left, top right, bottom right, bottom left. */
export function areaCorners(a: CloudArea): [[number, number], [number, number], [number, number], [number, number]] {
  return [
    [a.west, a.north],
    [a.east, a.north],
    [a.east, a.south],
    [a.west, a.south],
  ];
}

/**
 * Paints `area` at `t`. `strength` scales the opacity: the map in its own
 * chapter wants clouds that show but let the streets through; the backdrop,
 * already faint, the same.
 */
export function drawClouds(
  ctx: CanvasRenderingContext2D,
  grid: CloudGrid,
  t: number,
  area = gridArea(grid),
  strength = 1,
  palette = CLOUD_PALETTE,
  /** Grain per canvas pixel: above 1 for a map zoomed in close, so it shows banks of cloud, not one blob */
  detail = 1,
) {
  grain ??= makeGrain(GRAIN_SIZE);
  const { width, height } = ctx.canvas;
  const cols = grid.lons.length;
  const rows = grid.lats.length;
  const last = grid.times.length - 1;
  const t0 = Math.min(Math.max(Math.floor(t), 0), last);
  const t1 = Math.min(t0 + 1, last);
  const ft = clamp01(t - t0);
  const lonSpan = grid.lons[cols - 1] - grid.lons[0];
  const latSpan = grid.lats[0] - grid.lats[rows - 1];

  // Values of every grid point at this moment
  const cloud = grid.cloud[t0].map((v, i) => lerp(v, grid.cloud[t1][i], ft) / 100);
  const rain = grid.precip[t0].map((v, i) => lerp(v, grid.precip[t1][i], ft));

  const image = ctx.createImageData(width, height);
  const px = image.data;
  for (let y = 0; y < height; y++) {
    const lat = lerp(area.north, area.south, y / (height - 1));
    const gy = Math.min(Math.max(((grid.lats[0] - lat) / latSpan) * (rows - 1), 0), rows - 1);
    const r0 = Math.min(Math.floor(gy), rows - 2);
    const fy = gy - r0;
    const edgeY = smoothstep(0, 0.12, Math.min(y, height - 1 - y) / height);
    for (let x = 0; x < width; x++) {
      const lon = lerp(area.west, area.east, x / (width - 1));
      const gx = Math.min(Math.max(((lon - grid.lons[0]) / lonSpan) * (cols - 1), 0), cols - 1);
      const c0 = Math.min(Math.floor(gx), cols - 2);
      const fx = gx - c0;
      const i = r0 * cols + c0;
      const sample = (v: number[]) =>
        lerp(lerp(v[i], v[i + 1], fx), lerp(v[i + cols], v[i + cols + 1], fx), fy);

      const g = grainAt(grain, x * detail, y * detail);
      const edge = edgeY * smoothstep(0, 0.12, Math.min(x, width - 1 - x) / width) * strength;
      // Cover decides how much of the area is cloud, not how opaque it all is: the noise's top `c`
      // becomes cloud, with soft edges and thicker cores, so even an overcast sky keeps its shapes
      // and gaps. Never opaque, so the map's lines always read through.
      const c = sample(cloud);
      const cloudA = clamp01(
        smoothstep(1 - c - 0.08, 1 - c + 0.22, g) * (0.45 + 0.55 * smoothstep(1 - c, 1, g)) * palette.cloudAlpha * edge,
      );
      // Rain falls in cells of its own pattern (the noise, shifted), wider and stronger as the rate grows.
      const mm = sample(rain);
      let rainA = 0;
      if (mm >= 0.05) {
        const g2 = grainAt(grain, x * detail + 53, y * detail + 89);
        const f = Math.min(0.7, 0.15 + mm / 12);
        rainA = clamp01(smoothstep(1 - f - 0.06, 1 - f + 0.18, g2) * clamp01(0.4 + mm / 6) * palette.rainAlpha * edge);
      }

      // Rain over cloud, composed as "over"
      const a = rainA + cloudA * (1 - rainA);
      const o = (y * width + x) * 4;
      if (a <= 0) continue;
      for (let k = 0; k < 3; k++) {
        px[o + k] = (palette.rain[k] * rainA + palette.cloud[k] * cloudA * (1 - rainA)) / a;
      }
      px[o + 3] = a * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}
