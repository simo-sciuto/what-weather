/**
 * The sea on a coarse grid of the water (WTH-204), pure: 1 where the cell is water, 0 where it is not, row by row.
 * Mapbox draws sea and lakes in one layer with nothing to tell them apart, so the grid is read: each patch of water
 * is measured, and a patch that is large, or that reaches two edges of the sheet and is not small, is the sea. A rule
 * of thumb: a lake that fills half the sheet would read as sea.
 */

/** Water this large, or touching this many of the sheet's edges and this large, is sea; smaller or enclosed is a lake */
const SEA_SHARE = 0.06;
const SEA_EDGES = 2;
const SEA_EDGE_SHARE = 0.03;
/** How many cells the water is thinned by before it is measured: rivers narrower than about twice this come away */
const THIN = 4;
/** Water narrower than about twice this many cells is a river or a channel; wider, joined to the sea, is sea */
const NARROW = 2;

/** One step of thinning: a cell stays only if it and its four neighbours are set (past the sheet's edge is unset) */
function erode(from: Uint8Array, gw: number, gh: number): Uint8Array {
  const to = new Uint8Array(from.length);
  for (let y = 1; y < gh - 1; y++)
    for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x;
      to[i] = from[i] & from[i - 1] & from[i + 1] & from[i - gw] & from[i + gw];
    }
  return to;
}

/** One step of growth inside `within`: a cell is set if it or one of its four neighbours is */
function dilate(from: Uint8Array, gw: number, gh: number, within: Uint8Array): Uint8Array {
  const to = new Uint8Array(from.length);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (!within[i]) continue;
      to[i] = from[i] | (x > 0 ? from[i - 1] : 0) | (x < gw - 1 ? from[i + 1] : 0) | (y > 0 ? from[i - gw] : 0) | (y < gh - 1 ? from[i + gw] : 0);
    }
  return to;
}

function thinned(water: Uint8Array, gw: number, gh: number, steps: number): Uint8Array {
  let out = water;
  for (let k = 0; k < steps; k++) out = erode(out, gw, gh);
  return out;
}

/** A cell's four neighbours on the grid, each passed to `visit` */
function forNeighbours(i: number, gw: number, gh: number, visit: (j: number) => void) {
  const x = i % gw;
  if (x > 0) visit(i - 1);
  if (x < gw - 1) visit(i + 1);
  if (i >= gw) visit(i - gw);
  if (i < (gh - 1) * gw) visit(i + gw);
}

/** The sea's cells (1) on a grid of the water, `gw` by `gh`: each patch measured once, then one flood through the wide water */
export function seaGrid(water: Uint8Array, gw: number, gh: number): Uint8Array {
  const n = gw * gh;
  // Thinned first: a river, narrow, comes away from the sea it flows into, and is measured on its own
  const wet = thinned(water, gw, gh, THIN);
  const seen = new Uint8Array(n);
  const sea = new Uint8Array(n);
  const patch = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (!wet[start] || seen[start]) continue;
    let size = 0;
    let edges = 0;
    seen[start] = 1;
    patch[size++] = start;
    for (let k = 0; k < size; k++) {
      const i = patch[k];
      const [x, y] = [i % gw, (i / gw) | 0];
      if (x === 0) edges |= 1;
      if (x === gw - 1) edges |= 2;
      if (y === 0) edges |= 4;
      if (y === gh - 1) edges |= 8;
      forNeighbours(i, gw, gh, (j) => {
        if (wet[j] && !seen[j]) {
          seen[j] = 1;
          patch[size++] = j;
        }
      });
    }
    const touched = (edges & 1) + ((edges >> 1) & 1) + ((edges >> 2) & 1) + ((edges >> 3) & 1);
    const share = size / n;
    if (share >= SEA_SHARE || (touched >= SEA_EDGES && share >= SEA_EDGE_SHARE)) for (let k = 0; k < size; k++) sea[patch[k]] = 1;
  }
  // Then grown back: first through all the water that is not narrow (a harbour's basins, a bay behind a mole, joined
  // to the sea), as far as it reaches, in one flood; then over the last few cells of shore. A river, narrow, stops at
  // its mouth.
  const wide = thinned(water, gw, gh, NARROW);
  const queue = new Int32Array(n);
  let end = 0;
  for (let i = 0; i < n; i++) if (sea[i]) queue[end++] = i;
  for (let k = 0; k < end; k++)
    forNeighbours(queue[k], gw, gh, (j) => {
      if (wide[j] && !sea[j]) {
        sea[j] = 1;
        queue[end++] = j;
      }
    });
  let grown: Uint8Array = sea;
  for (let k = 0; k < NARROW + 2; k++) grown = dilate(grown, gw, gh, water);
  return grown;
}
