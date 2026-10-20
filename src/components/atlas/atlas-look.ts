import { ATLAS_LIGHT } from "@/constants/atlas";
import { mapInksFor, atmospherePalette } from "@/lib/weather/palette";
import { computeAtmosphere } from "@/lib/weather/visual-input";
import { mapOptionsSnapshot, parseMapOptions, subscribeMapOptions, type MapOption } from "@/lib/map-options";
import { mapTuningSnapshot, parseMapTuning, subscribeMapTuning, type MapTuning } from "@/lib/map-tuning";
import type { PointSky } from "@/types/atlas";
import type { SkyPalette } from "@/types/palette";
import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { activeLayers } from "@/lib/map/map-style";

/**
 * How the Atlas looks, from the pieces the home page already has: the atmosphere's palette (`atmospherePalette`) over
 * the solar scale, and the viewer's own choice of layers and tuning of the map's colours, kept in the same two stores.
 * With no point the sky is a clear one at the middle of the day; a point's weather colours it by the zoom (M5, `skyFor`).
 */

/** The palette of a clear sky at the middle of the day, worked out once */
export const ATLAS_PALETTE: SkyPalette = atmospherePalette(
  ATLAS_LIGHT,
  computeAtmosphere({ light: ATLAS_LIGHT, condition: "clear" }).atmosphere,
);

/** The neutral sky as the pieces a point's sky is made of: what the Atlas wears with no point, and what a far view tints */
export const ATLAS_SKY: PointSky = {
  sky1: ATLAS_PALETTE.sky1,
  sky2: ATLAS_PALETTE.sky2,
  sky3: ATLAS_PALETTE.sky3,
  glass: ATLAS_PALETTE.glass,
  glow: ATLAS_PALETTE.glow,
  sun: ATLAS_PALETTE.sun,
  cloud: ATLAS_PALETTE.cloud,
  air: ATLAS_PALETTE.air,
};

/**
 * The palette as the CSS custom properties the page's sky, glass and markers read: the same seven that `AtmosphereMain`
 * sets on the home page (TimeContext.tsx), written out here rather than shared so that the home is left as it is.
 */
export function paletteVars(p: PointSky): CSSProperties {
  return {
    "--sky-1": p.sky1,
    "--sky-2": p.sky2,
    "--sky-3": p.sky3,
    "--glass": p.glass,
    "--glow": p.glow,
    "--sun": p.sun,
    "--cloud": p.cloud,
  } as CSSProperties;
}

function useMapTuning(): MapTuning {
  const raw = useSyncExternalStore(subscribeMapTuning, mapTuningSnapshot, () => "");
  return useMemo(() => parseMapTuning(raw), [raw]);
}

function useMapOptions(): MapOption[] {
  const raw = useSyncExternalStore(subscribeMapOptions, mapOptionsSnapshot, () => "");
  return useMemo(() => parseMapOptions(raw), [raw]);
}

/** The colours of the map's layers, opposite the sky it is under, as the viewer tuned them, and the layers they chose */
export function useAtlasMapLook(sky: PointSky, override?: readonly MapOption[]): { inks: SkyPalette["map"]; options: MapOption[] } {
  const tuning = useMapTuning();
  const own = useMapOptions();
  // A layer other than Meteo draws its own options (WTH-346); the viewer's choice is kept for Meteo
  const options = useMemo(() => (override ? [...override] : own), [override, own]);
  const active = useMemo(() => activeLayers(options), [options]);
  const inks = useMemo(() => mapInksFor(sky.sky2, tuning, active, sky.air), [sky, tuning, active]);
  return { inks, options };
}

