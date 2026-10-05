import { atmosphericData } from "./atmospheric-data";
import { computeAtmosphere, type AtmosphereComputation } from "./visual-input";
import type { Frame } from "./frames";
import { atmospherePalette, type SkyPalette } from "./palette";
import { skyAt, type SkyPosition } from "./state";

/**
 * How a frame looks: the sky's colours and where the sun (or moon) sits.
 * Pure and cheap, so the browser works it out for the frame on show instead
 * of receiving it for every frame.
 */
export type FrameLook = {
  palette: SkyPalette;
  sky: SkyPosition;
  atmosphere: AtmosphereComputation["atmosphere"];
  atmosphereInputStatus: AtmosphereComputation["inputStatus"];
};

export function frameLook(f: Frame): FrameLook {
  // Daily max, peak UV and placeholder cloud/rain are not same-hour readings.
  const visual = computeAtmosphere({
    light: f.light,
    condition: f.condition,
    intensity: f.intensity,
    ...(f.overview ? {} : {
      ...atmosphericData(f),
      temp: f.temp,
      cloudCover: f.cloudCover,
      precipitation: f.precipitation,
      uvIndex: f.uv,
    }),
  });
  return {
    atmosphere: visual.atmosphere,
    atmosphereInputStatus: visual.inputStatus,
    // The palette is worked out from the atmosphere (WTH-046): the solar phase and the weather's continuous axes
    palette: atmospherePalette(f.light, visual.atmosphere),
    sky: skyAt(f.light, f.phase),
  };
}
