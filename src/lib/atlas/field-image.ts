import type { Lattice } from "@/types/atlas";

/**
 * The weather field as pixels (WTH-272): the lattice's colours, interpolated smoothly from one place to the next, over
 * the box the lattice covers. The rows follow the map's own projection (Web Mercator), because Mapbox stretches an image
 * between its corners in that projection: a row of the image is where the map has it, not where the degrees would put it.
 * Pure, so it is tested without a canvas. Beyond the lattice's edge a colour is the edge's.
 */

const MAX_LAT = 85.0511;
const toMercY = (lat: number) => {
  const s = Math.sin((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180);
  return Math.log((1 + s) / (1 - s)) / 2;
};
const fromMercY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16) || 0, parseInt(hex.slice(3, 5), 16) || 0, parseInt(hex.slice(5, 7), 16) || 0];

/** The two neighbours of `v` in a sorted list, and how far between them it is (0 to 1); at an edge, the edge twice */
function bracket(list: number[], v: number): [number, number, number] {
  if (v <= list[0]) return [0, 0, 0];
  const last = list.length - 1;
  if (v >= list[last]) return [last, last, 0];
  let i = 0;
  while (i < last - 1 && list[i + 1] <= v) i++;
  return [i, i + 1, (v - list[i]) / (list[i + 1] - list[i])];
}

/** The box a lattice covers, and the image's own corners: its outermost points */
export function latticeBox(l: Lattice) {
  return { west: l.lons[0], east: l.lons[l.lons.length - 1], south: l.lats[0], north: l.lats[l.lats.length - 1] };
}

/** RGBA pixels, `width` by `height`, row 0 at the north; `colors` in the lattice's order (south first) */
export function interpolateField(lattice: Lattice, colors: string[], width: number, height: number): Uint8ClampedArray {
  const { lats, lons } = lattice;
  const cols = lons.length;
  const box = latticeBox(lattice);
  const [yTop, yBottom] = [toMercY(box.north), toMercY(box.south)];
  const parsed = colors.map(rgb);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = fromMercY(yTop + ((y + 0.5) / height) * (yBottom - yTop));
    const [i0, i1, fy] = bracket(lats, lat);
    for (let x = 0; x < width; x++) {
      const lon = box.west + ((x + 0.5) / width) * (box.east - box.west);
      const [j0, j1, fx] = bracket(lons, lon);
      const a = parsed[i0 * cols + j0];
      const b = parsed[i0 * cols + j1];
      const c = parsed[i1 * cols + j0];
      const d = parsed[i1 * cols + j1];
      const o = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) {
        const south = a[k] + (b[k] - a[k]) * fx;
        const north = c[k] + (d[k] - c[k]) * fx;
        out[o + k] = south + (north - south) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
