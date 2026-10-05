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
 * - "map-cut": the map's strongest lines alone (motorways, main roads, railways, rivers, the water's edge), thickened
 *   a little and flattened to the paper's colour, which the composition lays over its large type, inside the
 *   letters only: the city's roads run through the numbers, as the shores do in the research's posters.
 */

/** The map's own layers whose lines cut the type, when the viewer shows them */
const CUT_LAYERS = ["motorways", "main-roads", "train", "metro", "waterway"] as const;
/** The water's edge, added to the record's own copy of the map for the cut */
const SHORE = "record-shore";

/** As on the poster: the map at twice its CSS size, so its lines keep the page's weight at print size */
const PIXEL_RATIO = 2;
/** The width of city the sheet spans at the page's top, as on the poster */
const SPAN_METRES = 30_000;
const MAP_TIMEOUT_MS = 25_000;
/** How much the cut lines are thickened, in print pixels, so they read through a heavy numeral */
const CUT_SPREAD = 3;

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
  /** The paper's colour, for the cut */
  paper: string;
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

/** The lines alone, thickened by drawing them a few times around a small circle, in one flat colour */
function flatten(lines: HTMLCanvasElement, colour: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  [c.width, c.height] = [lines.width, lines.height];
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.drawImage(lines, Math.cos(a) * CUT_SPREAD, Math.sin(a) * CUT_SPREAD);
  }
  ctx.drawImage(lines, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
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
      m.addLayer({ id: SHORE, type: "line", source: "streets", "source-layer": "water", paint: { "line-color": "#000", "line-width": 1.6 } });
      keep.add(SHORE);
    }
    for (const id of keep) if (id !== SHORE) m.setPaintProperty(id, "line-opacity", 1);
    await idle(m);
    const cut = flatten(copy(m, W, H), o.paper);

    return { map: whole.toDataURL("image/png"), "map-cut": cut.toDataURL("image/png") };
  } finally {
    map?.remove();
    box.remove();
    restore();
  }
}
