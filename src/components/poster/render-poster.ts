import type { MapOption } from "@/lib/map-options";
import type { SkyPalette } from "@/lib/weather/palette";
import type { WeatherFingerprint } from "@/lib/weather/fingerprint";
import type { SunPosition } from "@/lib/weather/sun-position";
import { getRecordComposition } from "@/lib/record/compose";
import { renderSvg } from "@/lib/record/render-svg";
import type { RecordInput } from "@/lib/record/types";
import { domMeasure, embeddedFontCss, loadRecordFonts, pageFontCss, svgToPng } from "../record/browser";
import { drawRecordMap } from "../record/record-map";

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
  /** The moment is a day's stand-in frame (`Frame.overview`): the stamp gives the date alone */
  allDay: boolean;
  /** The record's visual DNA at that moment (WTH-046J): the readout at the foot draws it */
  fingerprint: WeatherFingerprint;
  palette: SkyPalette;
  /** The extra map layers the viewer chose, and the sun at the moment on show for the shadows and lights */
  options: readonly MapOption[];
  sun: SunPosition;
  /** How the map behind the page was when the poster was asked for: the poster shows the same stretch of city, from the same angle */
  view: { zoom: number; pitch: number; bearing?: number };
  /** The temperature on show */
  temp: number;
  /** The moment's facts as the record engine reads them (WTH-187): the poster's layout is the Visual Record's */
  record: RecordInput;
  token: string;
  loadMapbox: () => Promise<Mapbox>;
}

/**
 * The poster, drawn in the browser as a Visual Record (WTH-187): the record engine composes the sheet from the
 * moment's weather (the type engine picks Open Atlas, Collision or Field Record), the site's own map is drawn under
 * it in the viewer's colours and layers with the city on the spot the layout chose, its strongest lines cut through
 * the large type, and the SVG is drawn to a PNG with its fonts inside.
 */
export async function renderPoster({ format, record, palette, options, sun, view, token, loadMapbox }: PosterInput): Promise<Blob> {
  const { width, height } = POSTER_FORMATS[format];
  const measure = await recordMeasure();
  const compose = (factsAt?: number) => {
    const composed = getRecordComposition(record, null, measure, { width, height }, "raster", { factsAt });
    // The paper is the sky the viewer's map was drawn against
    return { ...composed, inks: { ...composed.inks, paper: palette.sky2 } };
  };
  let scene = compose();
  const [images, fontCss] = await Promise.all([
    drawRecordMap({ width, height, place: record.place, palette, options, sun, view, cityAt: scene.metadata.cityAt, token, loadMapbox }),
    embeddedFontCss(),
  ]);
  // The facts go where the drawn map is calmest (the sea, a park), measured on the map itself: the same map, the same
  // choice. The city's spot does not depend on it, so the map need not be drawn again.
  const calmest = await calmestSlot(images.map, scene.metadata.factsSlots ?? []);
  if (calmest > 0) scene = compose(calmest);
  return svgToPng(renderSvg(scene, "swiss-flat", { fontCss, images, title: scene.metadata.recordId }), width, height);
}

let measuring: Promise<ReturnType<typeof domMeasure>> | null = null;
/** The record's faces on the page, once, and the browser's measure of them */
function recordMeasure() {
  measuring ??= (async () => {
    const style = document.createElement("style");
    style.textContent = pageFontCss();
    document.head.append(style);
    await loadRecordFonts();
    return domMeasure();
  })();
  return measuring;
}

/**
 * Of the cells given (normalized), the one where the map is calmest: the least change in light between neighbouring
 * points, sampled on a small copy of the map. The layout's own cell keeps its place unless another is clearly calmer.
 */
async function calmestSlot(map: string, slots: { x: number; y: number; width: number; height: number }[]): Promise<number> {
  if (slots.length < 2) return 0;
  const img = new Image();
  img.src = map;
  await img.decode();
  const [w, h] = [Math.round(img.width / 8), Math.round(img.height / 8)];
  const c = document.createElement("canvas");
  [c.width, c.height] = [w, h];
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const lum = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  };
  const busy = slots.map((s) => {
    const [x0, y0] = [Math.floor(s.x * w), Math.floor(s.y * h)];
    const [x1, y1] = [Math.min(w - 1, Math.ceil((s.x + s.width) * w)), Math.min(h - 1, Math.ceil((s.y + s.height) * h))];
    let sum = 0;
    let n = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        sum += Math.abs(lum(x + 1, y) - lum(x, y)) + Math.abs(lum(x, y + 1) - lum(x, y));
        n++;
      }
    return n ? sum / n : Infinity;
  });
  let best = 0;
  for (let i = 1; i < busy.length; i++) if (busy[i] < busy[best] * 0.8) best = i;
  return best;
}
