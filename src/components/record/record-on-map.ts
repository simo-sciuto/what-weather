import { DEFAULT_MAP_OPTIONS, type MapOption } from "@/lib/map-options";
import { getRecordComposition, PRINT } from "@/lib/record/compose";
import { renderSvg } from "@/lib/record/render-svg";
import type { Measure, RecordInput, RecordScene } from "@/lib/record/types";
import { atmospherePalette } from "@/lib/weather/palette";
import { sunPosition } from "@/lib/weather/sun-position";
import { computeAtmosphere } from "@/lib/weather/visual-input";
import { BASE_ZOOM } from "../weather/map-view";
import { drawRecordMap } from "./record-map";

type Mapbox = typeof import("mapbox-gl").default;

/** "2026-10-05", "12:00", "GMT+2" to Unix seconds */
export function recordTime(r: Pick<RecordInput, "date" | "time" | "zone">): number {
  const [y, m, d] = r.date.split("-").map(Number);
  const [hh, mm] = r.time.split(":").map(Number);
  const offset = Number(/GMT([+-]\d+(?:\.\d+)?)/.exec(r.zone)?.[1] ?? 0);
  return Date.UTC(y, m - 1, d, hh - offset, mm) / 1000;
}

/**
 * A record over the site's own map: the composition in "raster" mode, then the map drawn off screen with the city on
 * the spot the composition chose, then the SVG with both pictures. The map's colours are the sky of the record's
 * moment (`atmospherePalette`), its layers the viewer's (the site's defaults here).
 */
export async function recordOnMap(
  r: RecordInput,
  measure: Measure,
  map: {
    token: string;
    loadMapbox: () => Promise<Mapbox>;
    options?: readonly MapOption[];
    view?: { zoom: number; pitch: number; bearing?: number };
  },
  svg: { fontCss?: string; idPrefix?: string; width?: number; height?: number } = {},
): Promise<{ scene: RecordScene; svg: string }> {
  const scene = getRecordComposition(r, null, measure, PRINT, "raster");
  const light = r.light ?? 0.5;
  const { atmosphere } = computeAtmosphere({
    light,
    temp: r.temp,
    condition: r.condition,
    intensity: r.intensity,
    cloudCover: r.cloudCover,
    humidity: r.humidity,
    visibility: r.visibility,
    precipitation: r.precipitation,
    uvIndex: r.uv,
  });
  const images = await drawRecordMap({
    width: scene.canvas.width,
    height: scene.canvas.height,
    place: r.place,
    palette: atmospherePalette(light, atmosphere),
    options: map.options ?? DEFAULT_MAP_OPTIONS,
    sun: sunPosition(recordTime(r), r.place.lat, r.place.lon),
    view: map.view ?? { zoom: BASE_ZOOM, pitch: 0 },
    cityAt: scene.metadata.cityAt,
    paper: scene.inks.paper,
    token: map.token,
    loadMapbox: map.loadMapbox,
  });
  return { scene, svg: renderSvg(scene, "swiss-flat", { ...svg, images }) };
}
