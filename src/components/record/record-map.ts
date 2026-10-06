import type { Map as MapboxMap } from "mapbox-gl";
import type { MapOption } from "@/lib/map-options";
import type { SkyPalette } from "@/lib/weather/palette";
import type { SunPosition } from "@/lib/weather/sun-position";
import { STYLE, syncMap } from "../weather/map-style";
import { BASE_ZOOM } from "../weather/map-view";

type Mapbox = typeof import("mapbox-gl").default;

/**
 * The record's map (WTH-187): the site's own map, its style and colours read as they are (`STYLE`, `syncMap`, never
 * changed), drawn off screen for the poster only, in two pictures:
 *
 * - "map": the whole map, as the page shows it, with the city on the spot the composition chose for it;
 * - "map-cut": the map's strong marks alone (lakes and rivers, motorways, main roads, railways, metro, tram; the
 *   sea is taken out, so it stays under the type), in their
 *   own colours over a soft shadow, which the composition lays over its large type, inside the letters only: the
 *   city's roads pass over the numbers and the name.
 */

/** The map's own layers whose lines cut the type, when the viewer shows them */
const CUT_LAYERS = ["water", "waterway", "motorways", "main-roads", "train", "metro", "tram"] as const;
/** The water's edge, added to the record's own copy of the map for the cut */
const SHORE = "record-shore";

/** As on the poster: the map at twice its CSS size, so its lines keep the page's weight at print size */
const PIXEL_RATIO = 2;
/** The width of city the sheet spans at the page's top, as on the poster */
const SPAN_METRES = 30_000;
const MAP_TIMEOUT_MS = 25_000;
/** How far past the sea's edge the cut is cleared, in print pixels, so its shore line goes with it */
const SEA_EDGE = 6;
/** Water this large, or touching this many of the sheet's edges and this large, is sea; smaller or enclosed is a lake */
const SEA_SHARE = 0.06;
const SEA_EDGES = 2;
const SEA_EDGE_SHARE = 0.03;
/** How many grid cells (8 print pixels each) the water is thinned by before it is measured: rivers narrower than about twice this come away */
const THIN = 4;

/**
 * The sea in a picture of the water alone (black where there is water). Mapbox draws sea and lakes in one layer with
 * nothing to tell them apart, so the picture is read: each patch of water is measured on a coarse grid, and a patch
 * that is large, or that reaches two edges of the sheet and is not small, is the sea. A rule of thumb: a lake that
 * fills half the sheet would read as sea.
 */
export function seaMask(water: HTMLCanvasElement): HTMLCanvasElement {
  const step = 8;
  const [gw, gh] = [Math.ceil(water.width / step), Math.ceil(water.height / step)];
  const small = document.createElement("canvas");
  [small.width, small.height] = [gw, gh];
  const sctx = small.getContext("2d", { willReadFrequently: true });
  const out = document.createElement("canvas");
  [out.width, out.height] = [water.width, water.height];
  if (!sctx) return out;
  sctx.drawImage(water, 0, 0, gw, gh);
  const px = sctx.getImageData(0, 0, gw, gh).data;
  const water0 = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) water0[i] = px[i * 4 + 3] > 128 ? 1 : 0;
  // Thinned first: a river, narrow, comes away from the sea it flows into, and is measured on its own
  const pass = (from: Uint8Array, keep: (v: number[]) => boolean, within?: Uint8Array) => {
    const to = new Uint8Array(from.length);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const around = [from[i], x > 0 ? from[i - 1] : 0, x < gw - 1 ? from[i + 1] : 0, y > 0 ? from[i - gw] : 0, y < gh - 1 ? from[i + gw] : 0];
        to[i] = keep(around) && (!within || within[i]) ? 1 : 0;
      }
    return to;
  };
  let wet = water0;
  for (let k = 0; k < THIN; k++) wet = pass(wet, (v) => v.every(Boolean));
  const label = new Int32Array(gw * gh).fill(-1);
  const seaCells = new Uint8Array(gw * gh);
  const stack: number[] = [];
  let id = 0;
  for (let start = 0; start < wet.length; start++) {
    if (!wet[start] || label[start] >= 0) continue;
    const cells: number[] = [];
    let edges = 0;
    const touched = [false, false, false, false];
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const i = stack.pop() as number;
      cells.push(i);
      const [x, y] = [i % gw, Math.floor(i / gw)];
      if (x === 0) touched[0] = true;
      if (x === gw - 1) touched[1] = true;
      if (y === 0) touched[2] = true;
      if (y === gh - 1) touched[3] = true;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (wet[j] && label[j] < 0) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    edges = touched.filter(Boolean).length;
    const share = cells.length / (gw * gh);
    if (share >= SEA_SHARE || (edges >= SEA_EDGES && share >= SEA_EDGE_SHARE)) for (const i of cells) seaCells[i] = 1;
    id++;
  }
  // Then grown back over the water it was thinned from, so the sea keeps its own shore (and a river only its mouth)
  let grown = seaCells;
  for (let k = 0; k < THIN + 1; k++) grown = pass(grown, (v) => v.some(Boolean), water0);
  const img = sctx.createImageData(gw, gh);
  for (let i = 0; i < gw * gh; i++) img.data[i * 4 + 3] = grown[i] ? 255 : 0;
  sctx.putImageData(img, 0, 0);
  const octx = out.getContext("2d");
  if (octx) {
    octx.imageSmoothingEnabled = true;
    // Only the sea's own pixels, at full resolution: the coarse mask chooses the patches, the water picture draws them
    octx.drawImage(small, 0, 0, out.width, out.height);
    octx.globalCompositeOperation = "source-in";
    octx.drawImage(water, 0, 0);
  }
  return out;
}

/** The shadow under the lines laid over the type, in print pixels */
const SHADOW_BLUR = 10;
const SHADOW_OFFSET = 4;

export type RecordMapInput = {
  width: number;
  height: number;
  place: { lat: number; lon: number };
  palette: SkyPalette;
  options: readonly MapOption[];
  sun: SunPosition;
  /** The page's view when the record was asked for: the same stretch of city, from the same angle */
  view: { zoom: number; pitch: number; bearing?: number };
  /** Where the city must land, normalized (the scene's `metadata.cityAt`) */
  cityAt: readonly [number, number];
  token: string;
  loadMapbox: () => Promise<Mapbox>;
};

function mapZoom(W: number, H: number, lat: number, viewZoom: number): number {
  const span = SPAN_METRES / 2 ** (viewZoom - BASE_ZOOM);
  const metresPerPx = span / (Math.min(W, H) / PIXEL_RATIO);
  return Math.log2((156_543.03 * Math.cos((lat * Math.PI) / 180)) / metresPerPx);
}

const idle = (map: MapboxMap) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Map timed out")), MAP_TIMEOUT_MS);
    map.once("idle", () => {
      clearTimeout(timer);
      resolve();
    });
    map.triggerRepaint();
  });

function copy(map: MapboxMap, W: number, H: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  [c.width, c.height] = [W, H];
  c.getContext("2d")?.drawImage(map.getCanvas(), 0, 0, W, H);
  return c;
}

/**
 * The lines alone, in their own colours, over a soft shadow cast down and to the right: laid inside the large type,
 * they read as passing over the letters rather than cut into them.
 */
function overShadow(lines: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  [c.width, c.height] = [lines.width, lines.height];
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = SHADOW_BLUR;
  ctx.shadowOffsetX = SHADOW_OFFSET;
  ctx.shadowOffsetY = SHADOW_OFFSET * 1.5;
  ctx.drawImage(lines, 0, 0);
  return c;
}

/** Both pictures, as PNG data URLs, for `renderSvg`'s `images` */
export async function drawRecordMap(o: RecordMapInput): Promise<{ map: string; "map-cut": string }> {
  const { width: W, height: H } = o;
  const mapboxgl = await o.loadMapbox();
  const [cssW, cssH] = [W / PIXEL_RATIO, H / PIXEL_RATIO];
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  Object.assign(box.style, { position: "fixed", left: "-100000px", top: "0", width: `${cssW}px`, height: `${cssH}px`, pointerEvents: "none" });
  document.body.append(box);

  // Mapbox draws at the screen's density and takes no option for it: set for this map's life, then given back
  const density = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => PIXEL_RATIO });
  const restore = () => {
    if (density) Object.defineProperty(window, "devicePixelRatio", density);
    else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
  };

  let map: MapboxMap | null = null;
  try {
    map = new mapboxgl.Map({
      container: box,
      accessToken: o.token,
      style: STYLE,
      center: [o.place.lon, o.place.lat],
      zoom: mapZoom(W, H, o.place.lat, o.view.zoom),
      pitch: o.view.pitch,
      bearing: o.view.bearing ?? 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      preserveDrawingBuffer: true,
    });
    const m = map;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Map timed out")), MAP_TIMEOUT_MS);
      m.once("load", () => {
        clearTimeout(timer);
        resolve();
      });
      m.once("error", (e) => {
        clearTimeout(timer);
        reject(e.error ?? new Error("Map failed"));
      });
    });

    // The city on its spot: move the centre by how far the place falls from where the composition wants it
    const at = m.project([o.place.lon, o.place.lat]);
    const [tx, ty] = [o.cityAt[0] * cssW, o.cityAt[1] * cssH];
    m.jumpTo({ center: m.unproject([cssW / 2 + (at.x - tx), cssH / 2 + (at.y - ty)]) });

    syncMap(m, { inks: o.palette.map, options: o.options, sun: o.sun, lat: o.place.lat, roadShadowScale: 2.2 });
    await idle(m);
    const whole = copy(m, W, H);

    // The cut: every other layer hidden, the strongest lines and the water's edge kept
    const showing = new Set(
      (m.getStyle()?.layers ?? []).filter((l) => m.getLayoutProperty(l.id, "visibility") !== "none").map((l) => l.id),
    );
    const keep = new Set<string>(CUT_LAYERS.filter((id) => showing.has(id)));
    for (const id of showing) if (!keep.has(id)) m.setLayoutProperty(id, "visibility", "none");
    if (showing.has("water")) {
      const water = o.palette.map.water.color;
      m.addLayer({ id: SHORE, type: "line", source: "streets", "source-layer": "water", paint: { "line-color": water, "line-width": 1.6 } });
      keep.add(SHORE);
    }
    // First the water alone, to tell the sea from lakes and wide rivers: the sea stays under the type
    let sea: HTMLCanvasElement | null = null;
    if (showing.has("water")) {
      for (const id of keep) m.setLayoutProperty(id, "visibility", "none");
      m.setLayoutProperty("water", "visibility", "visible");
      m.setPaintProperty("water", "fill-opacity", 1);
      m.setPaintProperty("water", "fill-color", "#000");
      await idle(m);
      sea = seaMask(copy(m, W, H));
      m.setPaintProperty("water", "fill-color", o.palette.map.water.color);
      for (const id of keep) m.setLayoutProperty(id, "visibility", "visible");
    }
    for (const id of keep)
      if (id !== SHORE) m.setPaintProperty(id, m.getLayer(id)?.type === "fill" ? "fill-opacity" : "line-opacity", 1);
    await idle(m);
    const lines = copy(m, W, H);
    if (sea) {
      // The sea and its shore taken out of the cut, a little wider than the water so its edge goes too
      const ctx = lines.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.filter = `blur(${Math.round(SEA_EDGE)}px)`;
        ctx.drawImage(sea, 0, 0);
        ctx.filter = "none";
        ctx.drawImage(sea, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }
    }
    const cut = overShadow(lines);

    return { map: whole.toDataURL("image/png"), "map-cut": cut.toDataURL("image/png") };
  } finally {
    map?.remove();
    box.remove();
    restore();
  }
}
