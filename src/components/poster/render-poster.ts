import { tempColor } from "@/lib/weather/temp-color";
import { formatCoords } from "@/lib/weather/formatters";
import type { MapOption } from "@/lib/map-options";
import type { SkyPalette } from "@/lib/weather/palette";
import type { WeatherFingerprint } from "@/lib/weather/fingerprint";
import { bloomRadius, bloomStops, parseGlow } from "@/lib/weather/bloom";
import type { SunPosition } from "@/lib/weather/sun-position";
import { STYLE, syncMap } from "../weather/map-style";
import { BASE_ZOOM } from "../weather/map-view";
import { readoutRows, readoutStamp, type ReadoutRow } from "./readout";

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
  /** The moment on show (Unix seconds) and the place's time zone, for the stamp over the readout */
  time: number;
  timeZone: string;
  /** The record's visual DNA at that moment (WTH-046J): the readout at the foot draws it */
  fingerprint: WeatherFingerprint;
  palette: SkyPalette;
  /** The extra map layers the viewer chose, and the sun at the moment on show for the shadows and lights */
  options: readonly MapOption[];
  sun: SunPosition;
  /** How the map behind the page was when the poster was asked for: the poster shows the same stretch of city, from the same angle */
  view: { zoom: number; pitch: number; bearing?: number };
  /** The temperature on show: the name and the country are set in its colour (the scale the page uses) */
  temp: number;
  token: string;
  loadMapbox: () => Promise<Mapbox>;
}

/**
 * The poster, drawn in the browser: the sky of the moment, the city's lines
 * in the colours opposite it (the same drawing as behind the page, with no
 * veil and no fade), and, set on a Swiss grid, the place's name, large, black
 * and tight, its region and country, its coordinates and compass, and the
 * moment's weather as a readout of bars. The map is the subject; the
 * type holds the edges. Returns a PNG.
 */
export async function renderPoster({
  format,
  place,
  time,
  timeZone,
  fingerprint,
  palette,
  options,
  sun,
  view,
  temp,
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
    readoutStamp(time, timeZone),
    palette,
    fonts,
    tempColor(temp),
    view.bearing ?? 0,
    readoutRows(fingerprint),
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
}: Omit<PosterInput, "format" | "time" | "timeZone" | "fingerprint" | "temp"> & {
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
      // Turned as the viewer turned it, on a phone
      bearing: view.bearing ?? 0,
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

  // The light, high on the right as on the page: a bloom with the page's reach, its colour fading in alpha only
  const [x, y] = [W * 0.78, H * 0.14];
  const channels = parseGlow(p.glow);
  if (!channels) return;
  const [gr, gg, gb, ga] = channels;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, bloomRadius(W, H, x, y));
  for (const { offset, share } of bloomStops())
    glow.addColorStop(offset, `rgba(${gr}, ${gg}, ${gb}, ${(ga * share).toFixed(4)})`);
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
  /** "03.10.2026 · 18:42 CEST", over the readout */
  stamp: string,
  p: SkyPalette,
  fonts: Fonts,
  /** The colour of the temperature on show, for the name and the country */
  accent: string,
  /** How far the map is turned, in degrees: the compass at the foot shows it */
  bearing: number,
  readout: ReadoutRow[],
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

  // Head: the region flush left, the country flush right in bold capitals in the colour of the temperature
  // (with only one of the two, it keeps to its own side), over a hairline across the grid.
  const placeBase = m + small * 1.1;
  if (place.region) {
    setType(ctx, `500 SIZE ${fonts.sans}`, small * 1.35, 0);
    ctx.globalAlpha = 0.9;
    ctx.textAlign = "left";
    ctx.fillText(place.region, m, placeBase);
    ctx.globalAlpha = 1;
  }
  if (place.country) {
    setType(ctx, `700 SIZE ${fonts.sans}`, small * 1.35, 0.06);
    ctx.fillStyle = accent;
    ctx.textAlign = place.region ? "right" : "left";
    ctx.fillText(
      place.country.toUpperCase(),
      place.region ? W - m : m,
      placeBase,
    );
    ctx.fillStyle = "#ffffff";
  }
  ctx.textAlign = "left";
  const headRule = placeBase + small * 0.9;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(m, headRule, W - 2 * m, rule);
  ctx.globalAlpha = 1;

  // Foot, under a hairline, on two columns, its last line on the bottom margin. On the left where: latitude
  // and longitude (each a small label over its figure) and the compass, with the wordmark at the foot like a
  // print's signature and the map's credits under it, in the margin. On the right, small, the readout: the
  // moment's stamp over the record's fingerprint as bars. Over the hairline, the name.
  const bottom = H - m;
  const mark = small * 1.9;
  const right = W - m;
  const readoutLeft = m + (W - 2 * m) * 0.56;
  const stampSize = small * 0.62;
  const readoutLabel = small * 0.5;
  const rowH = small * 0.8;
  const estimated = readout.some((r) => r.estimated);
  // Baselines from the bottom up: the note on outlines (only when a row is one), the rows, the stamp
  const lastRowBase = bottom - (estimated ? rowH : 0);
  const firstRowBase = lastRowBase - (readout.length - 1) * rowH;
  const stampBase = firstRowBase - readoutLabel - small * 0.9;
  const footTop = stampBase - stampSize;
  const ruleY = footTop - small * 1.1;

  ctx.globalAlpha = 0.45;
  ctx.fillRect(m, ruleY, W - 2 * m, rule);
  ctx.globalAlpha = 1;

  // Latitude and longitude, side by side, each a small label over its figure, and a third column: the
  // compass, with the point the map faces beside it
  const [lat, lon] = formatCoords(place.lat, place.lon);
  const coordLabel = small * 0.5;
  const coordFigure = small * 1.25;
  const coordTop = footTop;
  const coordGap = (readoutLeft - small * 1.5 - m) / 3;
  (
    [
      ["Latitudine", lat],
      ["Longitudine", lon],
    ] as const
  ).forEach(([label, figure], i) => {
    const x = m + i * coordGap;
    setType(ctx, `600 SIZE ${fonts.sans}`, coordLabel, LABEL_TRACKING);
    ctx.globalAlpha = 0.65;
    ctx.fillText(label.toUpperCase(), x, coordTop + coordLabel);
    ctx.globalAlpha = 1;
    setType(ctx, `500 SIZE ${fonts.sans}`, coordFigure, -0.005);
    ctx.fillText(figure, x, coordTop + coordLabel + coordFigure * 1.25);
  });
  paintCompass(
    ctx,
    m + 2 * coordGap,
    coordTop,
    small,
    bearing,
    accent,
    fonts.sans,
  );

  // The signature: the wordmark at the foot of the left column, on the readout's last line
  paintWordmark(ctx, m, bottom, mark, fonts.poster);

  // The map's credits, under the wordmark
  setType(ctx, `500 SIZE ${fonts.sans}`, small * 0.7, 0.02);
  ctx.globalAlpha = 0.6;
  ctx.fillText("© Mapbox  © OpenStreetMap", m, bottom + small * 1.7);
  ctx.globalAlpha = 1;

  // The readout's head: the moment, at the place and on its clock
  setType(ctx, `600 SIZE ${fonts.sans}`, stampSize, 0.06);
  ctx.globalAlpha = 0.9;
  ctx.fillText(stamp, readoutLeft, stampBase);
  ctx.globalAlpha = 1;

  paintReadout(ctx, readoutLeft, right, firstRowBase, rowH, readoutLabel, readout, accent, rule, fonts.sans);

  const { size, lines } = setName(
    ctx,
    place.name,
    fonts.poster,
    W - 2 * m,
    short * 0.26,
    H * 0.32,
  );
  setType(ctx, `800 SIZE ${fonts.poster}`, size, -0.045);
  ctx.fillStyle = accent;
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

/** The eight points, from north clockwise, by their Italian initials */
const POINTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/**
 * The compass at the poster's foot: a hairline ring and a needle in the colour of the temperature
 * pointing at north as the map is turned, and beside it the point the map faces ("NE"), in bold capitals.
 * `x` and `top` are its column's left edge and the line it hangs from.
 */
function paintCompass(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  small: number,
  bearing: number,
  color: string,
  family: string,
) {
  const r = small * 1.45;
  const cx = x + r;
  const cy = top + r + small * 0.05;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(2, small * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // The needle turns the other way to the map
  ctx.translate(cx, cy);
  ctx.rotate((-bearing * Math.PI) / 180);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.8);
  ctx.lineTo(r * 0.16, 0);
  ctx.lineTo(-r * 0.16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.8);
  ctx.lineTo(r * 0.16, 0);
  ctx.lineTo(-r * 0.16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = color;
  setType(ctx, `700 SIZE ${family}`, small * 1.5, 0.04);
  ctx.textAlign = "left";
  ctx.fillText(
    POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8],
    cx + r + small * 0.6,
    cy + small * 0.45,
  );
  ctx.restore();
}

/** What a name is set as: capitals, small and widely spaced, as a printer's colour bar names its inks */
const LABEL_TRACKING = 0.1;

/**
 * The readout's rows, from `left` to `right`, the first label's baseline on `firstBase`: each axis's name in
 * small capitals, then its bar on a hairline track as long as the column allows. Warmth starts from a tick in
 * the middle, cold to the left and hot to the right, in the colour of the temperature; the rest fill from the
 * left in white. An estimated axis is drawn in outline, and a note under the rows says so.
 */
function paintReadout(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  firstBase: number,
  rowH: number,
  label: number,
  rows: ReadoutRow[],
  accent: string,
  rule: number,
  family: string,
) {
  setType(ctx, `600 SIZE ${family}`, label, LABEL_TRACKING);
  ctx.textAlign = "left";
  const names = Math.max(...rows.map((r) => ctx.measureText(r.label.toUpperCase()).width));
  const trackLeft = left + names + label * 1.6;
  const trackW = right - trackLeft;
  const barH = Math.max(rule * 2, label * 0.56);
  const line = Math.max(1, rule * 0.75);
  /** A bar, solid or in outline, over [x0, x1], centred on the x-height of a label set on `base` */
  const bar = (x0: number, x1: number, base: number, color: string, outline: boolean) => {
    const y = base - label * 0.36 - barH / 2;
    const w = x1 - x0;
    if (w <= 0) return;
    if (outline) {
      ctx.strokeStyle = color;
      ctx.lineWidth = line;
      ctx.strokeRect(x0 + line / 2, y + line / 2, Math.max(0, w - line), barH - line);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x0, y, w, barH);
    }
  };

  rows.forEach((r, i) => {
    const base = firstBase + i * rowH;
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.75;
    ctx.fillText(r.label.toUpperCase(), left, base);
    // The track: a hairline across the column, on the bar's middle
    ctx.globalAlpha = 0.3;
    ctx.fillRect(trackLeft, base - label * 0.36 - line / 2, trackW, line);
    ctx.globalAlpha = 1;
    if (r.centred) {
      const mid = trackLeft + trackW / 2;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(mid - line / 2, base - label * 0.36 - barH, line, barH * 2);
      ctx.globalAlpha = 1;
      const end = mid + (Math.max(-1, Math.min(1, r.value)) * trackW) / 2;
      bar(Math.min(mid, end), Math.max(mid, end), base, accent, r.estimated);
    } else {
      bar(trackLeft, trackLeft + Math.max(0, Math.min(1, r.value)) * trackW, base, "#ffffff", r.estimated);
    }
  });

  if (rows.some((r) => r.estimated)) {
    const base = firstBase + rows.length * rowH;
    ctx.globalAlpha = 0.6;
    bar(left, left + label * 2.2, base, "#ffffff", true);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("ESTIMATED, NOT MEASURED", left + label * 3, base);
    ctx.globalAlpha = 1;
  }
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
