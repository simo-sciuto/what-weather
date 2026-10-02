import { dayOfYear, formatCoords } from "@/lib/weather/formatters";
import type { MapOption } from "@/lib/map-options";
import { optionColor } from "@/lib/weather/map-swatch";
import type { SkyPalette } from "@/lib/weather/palette";
import type { SunPosition } from "@/lib/weather/sun-position";
import { STYLE, syncMap } from "../weather/map-style";
import { BASE_ZOOM } from "../weather/map-view";

type Mapbox = typeof import("mapbox-gl").default;

export type PosterFormat = "print" | "story" | "square";

/**
 * The sizes, in pixels. Each stays within 4096 on its long side, which most
 * graphics cards can draw in one go: the print size is A4 at 300 dpi (A3 at
 * about 210), the story a phone's 9:16, the square a social post.
 */
export const POSTER_FORMATS: Record<
  PosterFormat,
  { label: string; width: number; height: number }
> = {
  print: { label: "Stampa A", width: 2480, height: 3508 },
  story: { label: "Storia 9:16", width: 1440, height: 2560 },
  square: { label: "Quadrato", width: 2400, height: 2400 },
};

/** The map is drawn at twice its CSS size, so its lines keep the page's weight at poster scale. */
const PIXEL_RATIO = 2;
/**
 * The width of city the poster's short side spans, in metres, when the page is at its top: a whole city
 * with its streets. Scrolled down, the page zooms in, and the poster spans that much less (see `view`).
 */
const SPAN_METRES = 30_000;
/** Give up waiting for the map's tiles after this long, rather than hang. */
const MAP_TIMEOUT_MS = 25_000;
const ACCENT = "#f9e8a7";

export interface PosterInput {
  format: PosterFormat;
  /** The place, with its region and country in Italian (either may be empty) */
  place: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  };
  /** The local day ("2026-09-30") whose sky the poster is drawn in, for its number in the year */
  dayKey: string;
  palette: SkyPalette;
  /** The extra map layers the viewer chose, and the sun at the moment on show for the shadows and lights */
  options: readonly MapOption[];
  sun: SunPosition;
  /** How the map behind the page was when the poster was asked for: the poster shows the same stretch of city, from the same angle */
  view: { zoom: number; pitch: number };
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
export async function renderPoster({
  format,
  place,
  dayKey,
  palette,
  options,
  sun,
  view,
  token,
  loadMapbox,
}: PosterInput): Promise<Blob> {
  const { width: W, height: H } = POSTER_FORMATS[format];
  const [mapImage, fonts] = await Promise.all([
    drawMap({ W, H, place, palette, options, sun, view, token, loadMapbox }),
    loadFonts(),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  paintSky(ctx, W, H, palette);
  ctx.drawImage(mapImage, 0, 0, W, H);
  paintType(
    ctx,
    W,
    H,
    place,
    dayKey,
    palette,
    fonts,
    legendFor(palette, options, sun, mapZoom(W, H, place.lat, view.zoom)),
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/png",
    ),
  );
}

/* ---------- The map ---------- */

/**
 * The zoom at which the poster's short side spans the stretch of city the viewer has in front of them at this
 * latitude: SPAN_METRES at the top of the page, halved with each zoom level the page has come down.
 */
function mapZoom(W: number, H: number, lat: number, viewZoom: number): number {
  const span = SPAN_METRES / 2 ** (viewZoom - BASE_ZOOM);
  const metresPerPx = span / (Math.min(W, H) / PIXEL_RATIO);
  return Math.log2(
    (156_543.03 * Math.cos((lat * Math.PI) / 180)) / metresPerPx,
  );
}

/** A Mapbox map off screen, at the poster's size, in the moment's colours; resolves with its drawing. */
async function drawMap({
  W,
  H,
  place,
  palette,
  options,
  sun,
  view,
  token,
  loadMapbox,
}: Omit<PosterInput, "format" | "dayKey"> & {
  W: number;
  H: number;
}): Promise<HTMLCanvasElement> {
  const mapboxgl = await loadMapbox();
  const cssW = W / PIXEL_RATIO;
  const cssH = H / PIXEL_RATIO;
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  Object.assign(box.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${cssW}px`,
    height: `${cssH}px`,
    pointerEvents: "none",
  });
  document.body.append(box);

  const zoom = mapZoom(W, H, place.lat, view.zoom);

  // Mapbox draws at the screen's pixel density and takes no option for it, so, as its print
  // plugins do, the density is set for as long as this map lives, then given back.
  const density = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    get: () => PIXEL_RATIO,
  });
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
      // Tipped as far as the page is, as it is in the viewer's window
      pitch: view.pitch,
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
      const timer = setTimeout(
        () => reject(new Error("Map timed out")),
        MAP_TIMEOUT_MS,
      );
      map.once("load", () => {
        syncMap(map, {
          inks: palette.map,
          options,
          sun,
          lat: place.lat,
          roadShadowScale: 2.2,
        });
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

function paintSky(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: SkyPalette,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, p.sky1);
  sky.addColorStop(0.55, p.sky2);
  sky.addColorStop(1, p.sky3);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // The light, high on the right as on the page, softly.
  const r = Math.max(W, H) * 0.6;
  const glow = ctx.createRadialGradient(
    W * 0.78,
    H * 0.14,
    0,
    W * 0.78,
    H * 0.14,
    r,
  );
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
  const poster =
    css.getPropertyValue("--font-inter-tight").trim() ||
    "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const sans = poster;
  await Promise.all([
    document.fonts.load(`800 100px ${poster}`),
    document.fonts.load(`300 100px ${poster}`),
    document.fonts.load(`500 100px ${sans}`),
    document.fonts.load(`600 100px ${sans}`),
  ]).catch(() => undefined);
  return { poster, sans };
}

function setType(
  ctx: CanvasRenderingContext2D,
  font: string,
  size: number,
  tracking = 0,
) {
  ctx.font = `${font.replace("SIZE", `${size}px`)}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${tracking * size}px`;
}

/** The name in lines of whole words, as large as fits the width and a third of the height. */
function setName(
  ctx: CanvasRenderingContext2D,
  name: string,
  family: string,
  maxWidth: number,
  maxSize: number,
  maxHeight: number,
) {
  const words = name.split(/\s+/);
  for (let size = maxSize; size > 24; size *= 0.97) {
    setType(ctx, `800 SIZE ${family}`, size, -0.045);
    if (words.some((w) => ctx.measureText(w).width > maxWidth)) continue;
    const lines: string[] = [];
    for (const w of words) {
      const last = lines.at(-1);
      if (last && ctx.measureText(`${last} ${w}`).width <= maxWidth)
        lines[lines.length - 1] = `${last} ${w}`;
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
  legend: Swatch[],
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
  const [left, right] = place.region
    ? [place.region, place.country]
    : [place.country, ""];
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
  // The colour bar may take several rows; the hairline, and with it the name, make room for them
  const bar = layoutSwatches(ctx, legend, (W - 2 * m) * 0.6, small, fonts.sans);
  const ruleY = latBase - small * 2.3 - (bar.rows.length - 1) * bar.rowHeight;
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

  paintSwatches(ctx, W - m, swatchesTop, bar, fonts.sans);

  setType(ctx, `500 SIZE ${fonts.sans}`, small * 0.7, 0.02);
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.6;
  ctx.fillText("© Mapbox  © OpenStreetMap", W - m, creditsBase);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  // The signature: the wordmark, centred under the number, large enough to read across a room.
  paintWordmark(
    ctx,
    (W - wordmarkWidth(ctx, mark, fonts.poster)) / 2,
    bottom,
    mark,
    fonts.poster,
  );

  const { size, lines } = setName(
    ctx,
    place.name,
    fonts.poster,
    W - 2 * m,
    short * 0.26,
    H * 0.32,
  );
  setType(ctx, `800 SIZE ${fonts.poster}`, size, -0.045);
  const lead = size * 0.86;
  // The last line's baseline sits a little above the hairline.
  const lastBase = ruleY - size * 0.2;
  lines.forEach((line, i) =>
    ctx.fillText(
      line,
      m - size * 0.04,
      lastBase - (lines.length - 1 - i) * lead,
    ),
  );
}

/** The map's buildings are in Mapbox's tiles from this zoom; before it there are none to show. */
const BUILDING_ZOOM = 13;

/** One chip of the poster's colour bar: a colour, and what it stands for on the map. */
interface Swatch {
  hex: string;
  label: string;
  /** Starts a new group: a wider step before it than between chips of a group */
  groupStart?: boolean;
}

/**
 * What the poster's colour bar shows: the sky, then the colours the map is really
 * drawn with that the viewer has not taken away (not the shadows and the relief, which are shading, not a colour of their own), each as it shows over the middle of the sky (so the chips follow
 * everything the viewer tuned: the hue, the intensity and, through the lines'
 * opacity, the contrast). Only what is on this poster: the layers the viewer
 * chose, and of those only the ones that can be seen at this zoom and hour.
 */
function legendFor(
  p: SkyPalette,
  options: readonly MapOption[],
  sun: SunPosition,
  zoom: number,
): Swatch[] {
  const chosen = new Set(options);
  const close = zoom >= BUILDING_ZOOM;
  // What each choice is called here, short, in the order the poster lists them
  const named: [MapOption, string, boolean][] = [
    ["water", "Acqua", true],
    ["motorways", "Autostrade", true],
    ["main-roads", "Principali", true],
    ["streets", "Strade", true],
    ["green", "Verde", true],
    ["contours", "Curve", true],
    ["train", "Treni", true],
    ["metro", "Metro", true],
    ["tram", "Tram", zoom >= 14],
    ["bus", "Autobus", zoom >= 14],
    ["buildings", "Edifici", close],
    ["traffic", "Traffico", true],
    ["lights", "Luci", sun.altitude <= 0],
  ];
  const entries = named.filter(
    ([option, , seen]) => seen && chosen.has(option),
  );
  return [
    { hex: p.sky1, label: "Cielo alto" },
    { hex: p.sky2, label: "Cielo" },
    { hex: p.sky3, label: "Orizzonte" },
    ...entries.map(([option, label], i): Swatch => ({
      hex: optionColor(p, option),
      label,
      groupStart: i === 0,
    })),
  ];
}

interface SwatchBar {
  rows: Swatch[][];
  chipW: number;
  chipH: number;
  gap: number;
  groupGap: number;
  label: number;
  /** From one row's top to the next */
  rowHeight: number;
}

/** What a name is set as: capitals, small and widely spaced, as a printer's colour bar names its inks */
const LABEL_TRACKING = 0.1;

/** Sets the chips in rows no wider than `maxWidth`, every chip as wide as the longest name. */
function layoutSwatches(
  ctx: CanvasRenderingContext2D,
  swatches: Swatch[],
  maxWidth: number,
  small: number,
  family: string,
): SwatchBar {
  const label = small * 0.5;
  setType(ctx, `600 SIZE ${family}`, label, LABEL_TRACKING);
  const chipW =
    Math.max(
      ...swatches.map((s) => ctx.measureText(s.label.toUpperCase()).width),
    ) +
    label * 0.3;
  // A thin bar, not a block: the colour is a rule, as fine as the poster's own hairlines
  const chipH = small * 0.2;
  const gap = small * 0.6;
  const groupGap = small * 1.5;
  const rows: Swatch[][] = [[]];
  let used = 0;
  for (const s of swatches) {
    const row = rows[rows.length - 1];
    const before = row.length ? (s.groupStart ? groupGap : gap) : 0;
    if (row.length && used + before + chipW > maxWidth) {
      rows.push([s]);
      used = chipW;
    } else {
      row.push(s);
      used += before + chipW;
    }
  }
  return {
    rows,
    chipW,
    chipH,
    gap,
    groupGap,
    label,
    rowHeight: chipH + label * 1.6 + small * 0.9,
  };
}

/**
 * The poster's colours as a printer's colour bar, each row flush right from
 * `right`: a fine bar of each colour over the name of what it stands for (sky,
 * water, a kind of road, a building…) in small capitals.
 */
function paintSwatches(
  ctx: CanvasRenderingContext2D,
  right: number,
  top: number,
  bar: SwatchBar,
  family: string,
) {
  const { rows, chipW, chipH, gap, groupGap, label } = bar;
  setType(ctx, `600 SIZE ${family}`, label, LABEL_TRACKING);
  ctx.textAlign = "left";
  rows.forEach((row, r) => {
    const y = top + r * bar.rowHeight;
    const widths = row.map(
      (s, i) => chipW + (i === 0 ? 0 : s.groupStart ? groupGap : gap),
    );
    let x = right - widths.reduce((a, b) => a + b, 0);
    row.forEach((s, i) => {
      x += i === 0 ? 0 : s.groupStart ? groupGap : gap;
      ctx.fillStyle = s.hex;
      ctx.fillRect(x, y, chipW, chipH);
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.75;
      ctx.fillText(s.label.toUpperCase(), x, y + chipH + label * 1.6);
      ctx.globalAlpha = 1;
      x += chipW;
    });
  });
}

/** The wordmark's width at a size, to centre it. */
function wordmarkWidth(
  ctx: CanvasRenderingContext2D,
  size: number,
  family: string,
) {
  setType(ctx, `300 SIZE ${family}`, size, -0.02);
  const what = ctx.measureText("what").width;
  setType(ctx, `800 SIZE ${family}`, size, -0.05);
  return what + size * (0.08 + 0.34 + 0.08) + ctx.measureText("weather").width;
}

/** what (light), a butter bar low like a horizon, weather (black): the page's wordmark, on the canvas. */
function paintWordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  size: number,
  family: string,
) {
  setType(ctx, `300 SIZE ${family}`, size, -0.02);
  ctx.fillText("what", x, baseline);
  x += ctx.measureText("what").width + size * 0.08;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(
    x,
    baseline - size * 0.21,
    size * 0.34,
    size * 0.09,
    size * 0.045,
  );
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  x += size * 0.34 + size * 0.08;
  setType(ctx, `800 SIZE ${family}`, size, -0.05);
  ctx.fillText("weather", x, baseline);
}
