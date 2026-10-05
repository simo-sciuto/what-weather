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
  const composed = getRecordComposition(record, null, measure, { width, height }, "raster");
  // The paper is the sky the viewer's map was drawn against
  const scene = { ...composed, inks: { ...composed.inks, paper: palette.sky2 } };
  const [images, fontCss] = await Promise.all([
    drawRecordMap({ width, height, place: record.place, palette, options, sun, view, cityAt: scene.metadata.cityAt, token, loadMapbox }),
    embeddedFontCss(),
  ]);
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
