import { dayOfYear, formatCoords } from "@/lib/weather/formatters";
import { inkOverSky, type MapLayer, type SkyPalette } from "@/lib/weather/palette";
import { KIND, STYLE } from "../weather/map-style";

type Mapbox = typeof import("mapbox-gl").default;

export type PosterFormat = "print" | "story" | "square";

/**
 * The sizes, in pixels. Each stays within 4096 on its long side, which most
 * graphics cards can draw in one go: the print size is A4 at 300 dpi (A3 at
 * about 210), the story a phone's 9:16, the square a social post.
 */
export const POSTER_FORMATS: Record<PosterFormat, { label: string; width: number; height: number }> = {
  print: { label: "Stampa A", width: 2480, height: 3508 },
  story: { label: "Storia 9:16", width: 1440, height: 2560 },
  square: { label: "Quadrato", width: 2400, height: 2400 },
};

/** The map is drawn at twice its CSS size, so its lines keep the page's weight at poster scale. */
const PIXEL_RATIO = 2;
/** The width of city the poster's short side spans, in metres: a whole city with its streets. */
const SPAN_METRES = 30_000;
/** Give up waiting for the map's tiles after this long, rather than hang. */
const MAP_TIMEOUT_MS = 25_000;
const ACCENT = "#f9e8a7";

export interface PosterInput {
  format: PosterFormat;
  /** The place, with its region and country in Italian (either may be empty) */
  place: { name: string; region: string; country: string; lat: number; lon: number };
  /** The local day ("2026-09-30") whose sky the poster is drawn in, for its number in the year */
  dayKey: string;
  palette: SkyPalette;
  token: string;
  loadMapbox: () => Promise<Mapbox>;
}

/**
 * The poster, drawn in the browser: the sky of the moment, the city's lines
 * in the colours opposite it (the same drawing as behind the page, with no
 * veil and no fade), and, set on a Swiss grid, the place's name, large, black
 * and tight, its region and country, its coordinates, and the colours it was
 * drawn in. The map is the subject; the
 * type holds the edges. Returns a PNG.
 */
export async function renderPoster({ format, place, dayKey, palette, token, loadMapbox }: PosterInput): Promise<Blob> {
  const { width: W, height: H } = POSTER_FORMATS[format];
  const [mapImage, fonts] = await Promise.all([drawMap({ W, H, place, palette, token, loadMapbox }), loadFonts()]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  paintSky(ctx, W, H, palette);
  ctx.drawImage(mapImage, 0, 0, W, H);
  paintType(ctx, W, H, place, dayKey, palette, fonts);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))), "image/png"),
  );
}

/* ---------- The map ---------- */

/** A Mapbox map off screen, at the poster's size, in the moment's colours; resolves with its drawing. */
async function drawMap({
  W,
  H,
  place,
  palette,
  token,
  loadMapbox,
}: Omit<PosterInput, "format" | "dayKey"> & { W: number; H: number }): Promise<HTMLCanvasElement> {
  const mapboxgl = await loadMapbox();
  const cssW = W / PIXEL_RATIO;
  const cssH = H / PIXEL_RATIO;
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  Object.assign(box.style, { position: "fixed", left: "-100000px", top: "0", width: `${cssW}px`, height: `${cssH}px`, pointerEvents: "none" });
  document.body.append(box);

  // The zoom at which the short side spans SPAN_METRES at this latitude.
  const metresPerPx = SPAN_METRES / Math.min(cssW, cssH);
  const zoom = Math.log2((156_543.03 * Math.cos((place.lat * Math.PI) / 180)) / metresPerPx);

  // Mapbox draws at the screen's pixel density and takes no option for it, so, as its print
  // plugins do, the density is set for as long as this map lives, then given back.
  const density = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => PIXEL_RATIO });
  const restoreDensity = () => {
    if (density) Object.defineProperty(window, "devicePixelRatio", density);
    else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
  };

  let map: import("mapbox-gl").Map;
  try {
    map = new mapboxgl.Map({
      container: box,
      accessToken: token,
      style: STYLE,
      center: [place.lon, place.lat],
      zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 1,
      preserveDrawingBuffer: true,
    });
  } catch (e) {
    restoreDensity();
    box.remove();
    throw e;
  }
  // The city a little above the middle, clear of the name at the foot.
  map.setPadding({ top: 0, bottom: cssH * 0.18, left: 0, right: 0 });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Map timed out")), MAP_TIMEOUT_MS);
      map.once("load", () => {
        for (const layer of Object.keys(KIND) as MapLayer[]) {
          const kind = KIND[layer];
          map.setPaintProperty(layer, `${kind}-color` as "line-color", palette.map[layer].color);
          map.setPaintProperty(layer, `${kind}-opacity` as "line-opacity", palette.map[layer].opacity);
        }
        map.once("idle", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      map.once("error", (e) => {
        clearTimeout(timer);
        reject(e.error ?? new Error("Map failed"));
      });
    });
    // Copied out before the map (and its WebGL context) goes away.
    const copy = document.createElement("canvas");
    copy.width = W;
    copy.height = H;
    copy.getContext("2d")?.drawImage(map.getCanvas(), 0, 0, W, H);
    return copy;
  } finally {
    map.remove();
    box.remove();
    restoreDensity();
  }
}

/* ---------- The sky ---------- */

function rgba(hex: string, alpha: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function paintSky(ctx: CanvasRenderingContext2D, W: number, H: number, p: SkyPalette) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, p.sky1);
  sky.addColorStop(0.55, p.sky2);
  sky.addColorStop(1, p.sky3);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // The light, high on the right as on the page, softly.
  const r = Math.max(W, H) * 0.6;
  const glow = ctx.createRadialGradient(W * 0.78, H * 0.14, 0, W * 0.78, H * 0.14, r);
  glow.addColorStop(0, p.glow);
  glow.addColorStop(0.35, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- The type ---------- */

interface Fonts {
  poster: string;
  sans: string;
}

/** The page's own two families (named by next/font), loaded in the weights the poster sets. */
async function loadFonts(): Promise<Fonts> {
  const css = getComputedStyle(document.documentElement);
  const poster = css.getPropertyValue("--font-inter-tight").trim() || "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const sans = css.getPropertyValue("--font-geist-sans").trim() || "system-ui, sans-serif";
  await Promise.all([
    document.fonts.load(`800 100px ${poster}`),
    document.fonts.load(`300 100px ${poster}`),
    document.fonts.load(`500 100px ${sans}`),
  ]).catch(() => undefined);
  return { poster, sans };
}

function setType(ctx: CanvasRenderingContext2D, font: string, size: number, tracking = 0) {
  ctx.font = `${font.replace("SIZE", `${size}px`)}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${tracking * size}px`;
}

/** The name in lines of whole words, as large as fits the width and a third of the height. */
function setName(ctx: CanvasRenderingContext2D, name: string, family: string, maxWidth: number, maxSize: number, maxHeight: number) {
  const words = name.split(/\s+/);
  for (let size = maxSize; size > 24; size *= 0.97) {
    setType(ctx, `800 SIZE ${family}`, size, -0.045);
    if (words.some((w) => ctx.measureText(w).width > maxWidth)) continue;
    const lines: string[] = [];
    for (const w of words) {
      const last = lines.at(-1);
      if (last && ctx.measureText(`${last} ${w}`).width <= maxWidth) lines[lines.length - 1] = `${last} ${w}`;
      else lines.push(w);
    }
    if (lines.length * size * 0.86 <= maxHeight) return { size, lines };
  }
  return { size: 24, lines: words };
}

function paintType(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  place: PosterInput["place"],
  dayKey: PosterInput["dayKey"],
  p: SkyPalette,
  fonts: Fonts,
) {
  const short = Math.min(W, H);
  const m = Math.round(short * 0.065);
  const rule = Math.max(2, Math.round(short / 900));
  const small = Math.round(short * 0.021);

  // A shade of the sky's top rising from the foot, so the name reads over any street.
  const shade = ctx.createLinearGradient(0, H * 0.5, 0, H);
  shade.addColorStop(0, rgba(p.sky1, 0));
  shade.addColorStop(0.55, rgba(p.sky1, 0.55));
  shade.addColorStop(1, rgba(p.sky1, 0.85));
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * 0.5, W, H * 0.5);
  // And a lighter one at the head, under the region and country.
  const head = ctx.createLinearGradient(0, 0, 0, m * 3.5);
  head.addColorStop(0, rgba(p.sky1, 0.6));
  head.addColorStop(1, rgba(p.sky1, 0));
  ctx.fillStyle = head;
  ctx.fillRect(0, 0, W, m * 3.5);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";

  // Head: the region flush left and the country flush right (with only one of
  // the two, it keeps to the left), over a hairline across the grid.
  const placeBase = m + small * 1.1;
  setType(ctx, `500 SIZE ${fonts.sans}`, small * 1.35, 0);
  ctx.globalAlpha = 0.9;
  const [left, right] = place.region ? [place.region, place.country] : [place.country, ""];
  ctx.textAlign = "left";
  ctx.fillText(left, m, placeBase);
  if (right) {
    ctx.textAlign = "right";
    ctx.fillText(right, W - m, placeBase);
    ctx.textAlign = "left";
  }
  const headRule = placeBase + small * 0.9;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(m, headRule, W - 2 * m, rule);
  ctx.globalAlpha = 1;

  // Foot, laid from the bottom up. Centred at the very foot, the day of the year
  // and under it the wordmark, like a print's number and signature. Over them,
  // under a hairline, two columns of small print: on the left where (latitude
  // over longitude), on the right the colours this poster was drawn in, then
  // the map's credits. Over the hairline, the name.
  const bottom = H - m;
  const mark = small * 1.9;
  const dayBase = bottom - mark * 1.3;
  const creditsBase = dayBase - small * 2.6;
  const lonBase = creditsBase;
  const latBase = lonBase - small * 1.9;
  const ruleY = latBase - small * 2.3;
  const swatchesTop = ruleY + small * 0.8;

  ctx.globalAlpha = 0.45;
  ctx.fillRect(m, ruleY, W - 2 * m, rule);
  ctx.globalAlpha = 1;

  const [lat, lon] = formatCoords(place.lat, place.lon);
  ctx.textAlign = "left";
  setType(ctx, `500 SIZE ${fonts.sans}`, small * 1.2, 0.01);
  ctx.fillText(lat, m, latBase);
  ctx.fillText(lon, m, lonBase);

  // Last, centred at the foot: the day of the year, like the number pencilled under a limited edition print.
  setType(ctx, `300 SIZE ${fonts.poster}`, small * 1.1, 0.04);
  ctx.textAlign = "center";
  ctx.globalAlpha = 0.9;
  ctx.fillText(dayOfYear(dayKey), W / 2, dayBase);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  paintSwatches(ctx, W - m, swatchesTop, small, p, fonts.sans);

  setType(ctx, `500 SIZE ${fonts.sans}`, small * 0.7, 0.02);
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.6;
  ctx.fillText("© Mapbox  © OpenStreetMap", W - m, creditsBase);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  // The signature: the wordmark, centred under the number, large enough to read across a room.
  paintWordmark(ctx, (W - wordmarkWidth(ctx, mark, fonts.poster)) / 2, bottom, mark, fonts.poster);

  const { size, lines } = setName(ctx, place.name, fonts.poster, W - 2 * m, short * 0.26, H * 0.32);
  setType(ctx, `800 SIZE ${fonts.poster}`, size, -0.045);
  const lead = size * 0.86;
  // The last line's baseline sits a little above the hairline.
  const lastBase = ruleY - size * 0.2;
  lines.forEach((line, i) => ctx.fillText(line, m - size * 0.04, lastBase - (lines.length - 1 - i) * lead));
}

/**
 * The poster's colours as a printer's colour bar, flush right from `right`:
 * the sky (top, middle, horizon), then, a step apart, the roads (motorways,
 * main roads, streets) as they show over the middle of the sky, so the chips
 * follow everything the viewer tuned (the hue, the intensity and, through the
 * lines' opacity, the contrast); each a chip over its hex code.
 */
function paintSwatches(ctx: CanvasRenderingContext2D, right: number, top: number, small: number, p: SkyPalette, family: string) {
  const groups = [
    [p.sky1, p.sky2, p.sky3],
    [p.map.motorways, p.map["main-roads"], p.map.streets].map((ink) => inkOverSky(p.sky2, ink)),
  ];
  const label = small * 0.62;
  setType(ctx, `500 SIZE ${family}`, label, 0.02);
  const chipW = ctx.measureText("#000000").width;
  const chipH = small * 1.2;
  const gap = small * 0.35;
  const groupGap = small * 1.1;
  const widths = groups.map((g) => g.length * chipW + (g.length - 1) * gap);
  let x = right - widths.reduce((a, b) => a + b, 0) - groupGap * (groups.length - 1);

  ctx.textAlign = "left";
  groups.forEach((g) => {
    for (const hex of g) {
      ctx.fillStyle = hex;
      ctx.fillRect(x, top, chipW, chipH);
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.8;
      ctx.fillText(hex.toUpperCase(), x, top + chipH + label * 1.45);
      ctx.globalAlpha = 1;
      x += chipW + gap;
    }
    x += groupGap - gap;
  });
}

/** The wordmark's width at a size, to centre it. */
function wordmarkWidth(ctx: CanvasRenderingContext2D, size: number, family: string) {
  setType(ctx, `300 SIZE ${family}`, size, -0.02);
  const what = ctx.measureText("what").width;
  setType(ctx, `800 SIZE ${family}`, size, -0.05);
  return what + size * (0.08 + 0.34 + 0.08) + ctx.measureText("weather").width;
}

/** what (light), a butter bar low like a horizon, weather (black): the page's wordmark, on the canvas. */
function paintWordmark(ctx: CanvasRenderingContext2D, x: number, baseline: number, size: number, family: string) {
  setType(ctx, `300 SIZE ${family}`, size, -0.02);
  ctx.fillText("what", x, baseline);
  x += ctx.measureText("what").width + size * 0.08;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(x, baseline - size * 0.21, size * 0.34, size * 0.09, size * 0.045);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  x += size * 0.34 + size * 0.08;
  setType(ctx, `800 SIZE ${family}`, size, -0.05);
  ctx.fillText("weather", x, baseline);
}
