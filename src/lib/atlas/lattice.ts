import { FIELD_MAX_POINTS, FIELD_STEPS } from "@/constants/atlas";
import type { Bounds, Camera, Lattice } from "@/types/atlas";

/**
 * The lattice of places the weather field asks about (WTH-272): points on a fixed grid of whole steps that covers a view
 * and a little more, with the finest step that keeps the number of points within `FIELD_MAX_POINTS`. The grid is fixed so
 * that the same view, and the views next to it, ask for the same places and share the cache. The server works it out from
 * the box, so a caller cannot ask for more than the cap.
 */

const MAX_LAT = 85;
const clampLat = (v: number) => Math.min(MAX_LAT, Math.max(-MAX_LAT, v));
const fix = (v: number) => Number(v.toFixed(4));

export function latticeFor(bounds: Bounds): Lattice {
  const south = clampLat(Math.min(bounds.south, bounds.north));
  const north = clampLat(Math.max(bounds.south, bounds.north));
  // The box in longitude, round the world if need be: a view wider than the world is the world
  const span = Math.min(360, Math.max(0, bounds.east - bounds.west));
  const west = span === 360 ? -180 : bounds.west;

  for (const step of FIELD_STEPS) {
    const row0 = Math.floor(south / step);
    const row1 = Math.ceil(north / step);
    const col0 = Math.floor(west / step);
    const col1 = Math.ceil((west + span) / step);
    // a view that falls on one line of the grid still has a point either side of it
    const rows = Math.max(2, row1 - row0 + 1);
    const cols = Math.max(2, col1 - col0 + 1);
    if (rows * cols <= FIELD_MAX_POINTS || step === FIELD_STEPS[FIELD_STEPS.length - 1]) {
      const lats = Array.from({ length: rows }, (_, i) => fix(clampLat((row0 + i) * step)));
      const lons = Array.from({ length: cols }, (_, j) => fix((col0 + j) * step));
      return { step, lats, lons };
    }
  }
  // unreachable: the coarsest step ends the loop
  throw new Error("no lattice");
}

/** The box the camera sees, enlarged to its diagonal when the map is turned (what a turn shows is not known to the box) */
export function viewBounds(camera: Camera, size: { width: number; height: number }): Bounds {
  const world = 512 * 2 ** camera.zoom;
  const turned = camera.bearing % 360 !== 0;
  const [w, h] = turned ? [Math.hypot(size.width, size.height), Math.hypot(size.width, size.height)] : [size.width, size.height];
  const toY = (lat: number) => {
    const s = Math.sin((clampLat(lat) * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
  };
  const toLat = (y: number) => {
    const n = Math.PI - (2 * Math.PI * y) / world;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };
  const cy = toY(camera.lat);
  const dLon = (w / world) * 360;
  return {
    west: camera.lng - dLon / 2,
    east: camera.lng + dLon / 2,
    north: clampLat(toLat(cy - h / 2)),
    south: clampLat(toLat(cy + h / 2)),
  };
}

/** Two lattices that ask about the same places */
export const sameLattice = (a: Lattice | null, b: Lattice | null): boolean =>
  !!a && !!b && a.step === b.step && a.lats[0] === b.lats[0] && a.lons[0] === b.lons[0] && a.lats.length === b.lats.length && a.lons.length === b.lons.length;
