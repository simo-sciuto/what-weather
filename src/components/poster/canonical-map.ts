import { DEFAULT_MAP_OPTIONS, type MapOption } from "@/lib/map-options";
import { MAP_TUNING } from "@/lib/map-tuning";
import { mapInksFor } from "@/lib/weather/palette";
import type { SkyPalette } from "@/types/palette";
import { activeLayers } from "../weather/map-style";

/** The layers a poster is drawn with: the page's own, whatever Explore was left at (WTH-243) */
export const POSTER_MAP_OPTIONS: readonly MapOption[] = DEFAULT_MAP_OPTIONS;

/**
 * The poster's map colours, as a browser that has never tuned the map draws them: the moment's palette, the page's
 * own tuning, the default layers. Nothing stored in the browser is read, so the same place, moment and weather give
 * the same record on any browser and whatever Explore was set to (ADR-018, WTH-243). The sky is the moment's.
 */
export function posterMapPalette(palette: SkyPalette): SkyPalette {
  return { ...palette, map: mapInksFor(palette.sky2, MAP_TUNING, activeLayers(POSTER_MAP_OPTIONS), palette.air) };
}
