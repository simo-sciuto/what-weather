import type { Map as MapboxMap } from "mapbox-gl";
import type { MapOption } from "@/lib/map-options";
import { inkOverSky } from "@/lib/weather/palette";
import type { SunPosition } from "@/lib/weather/sun-position";
import type { Mapbox } from "@/types/map";
import type { MapLayer, SkyPalette } from "@/types/palette";
import { STYLE, syncMap } from "../weather/map-style";
import { BASE_ZOOM } from "../weather/map-view";
import { seaGrid } from "./sea-grid";

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

/** The sea in a picture of the water alone (black where there is water), read on a coarse grid by `seaGrid` */
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
  const wet = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) wet[i] = px[i * 4 + 3] > 128 ? 1 : 0;
  const grown = seaGrid(wet, gw, gh);
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

/** The most of the name's box the marks laid over it may cover, 0..1 */
const CUT_BUDGET = 0.12;

/** The share of a box (normalized) that a picture's marks cover, on a small copy */
export function coverage(lines: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }): number {
  const [sx, sy, sw, sh] = [box.x * lines.width, box.y * lines.height, box.width * lines.width, box.height * lines.height];
  if (sw <= 0 || sh <= 0) return 0;
  const w = 240;
  const h = Math.max(1, Math.round((w * sh) / sw));
  const c = document.createElement("canvas");
  [c.width, c.height] = [w, h];
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(lines, sx, sy, sw, sh, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let on = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 60) on++;
  return on / (w * h);
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
  /** The name's box, normalized (the scene's `metadata.nameBox`): the marks over it are kept few enough to read it */
  nameBox?: { x: number; y: number; width: number; height: number };
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
      const water = inkOverSky(o.palette.sky2, o.palette.map.water);
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
      m.setPaintProperty("water", "fill-color", inkOverSky(o.palette.sky2, o.palette.map.water));
      for (const id of keep) m.setLayoutProperty(id, "visibility", "visible");
    }
    // Inside the letters each mark keeps the colour it has on the map: its ink laid over the sky, made solid, so the
    // river crossing the name is the same river as around it, on top of the letters, not a darker channel under them
    for (const id of keep) {
      if (id === SHORE) continue;
      const fill = m.getLayer(id)?.type === "fill";
      const ink = o.palette.map[id as MapLayer];
      if (ink) m.setPaintProperty(id, fill ? "fill-color" : "line-color", inkOverSky(o.palette.sky2, ink));
      m.setPaintProperty(id, fill ? "fill-opacity" : "line-opacity", 1);
    }
    // The marks laid over the name, in tiers from the fullest down: a tier is used only while it leaves the name
    // legible (it covers at most CUT_BUDGET of the name's box); a dense water country (polders, canals) falls back to
    // the main lines, then to motorways and railways alone
    const draw = async (ids: Set<string>) => {
      for (const id of keep) m.setLayoutProperty(id, "visibility", ids.has(id) ? "visible" : "none");
      await idle(m);
      const canvas = copy(m, W, H);
      if (sea) {
        // The sea and its shore taken out, a little wider than the water so its edge goes too
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.filter = `blur(${Math.round(SEA_EDGE)}px)`;
          ctx.drawImage(sea, 0, 0);
          ctx.filter = "none";
          ctx.drawImage(sea, 0, 0);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      return canvas;
    };
    const tiers = [
      new Set(keep),
      new Set([...keep].filter((id) => id !== "water" && id !== SHORE)),
      new Set([...keep].filter((id) => id === "motorways" || id === "train")),
    ];
    let lines = await draw(tiers[0]);
    for (let t = 1; t < tiers.length && o.nameBox && coverage(lines, o.nameBox) > CUT_BUDGET; t++) lines = await draw(tiers[t]);
    const cut = overShadow(lines);

    return { map: whole.toDataURL("image/png"), "map-cut": cut.toDataURL("image/png") };
  } finally {
    map?.remove();
    box.remove();
    restore();
  }
}
