import { atmosphericData } from "./atmospheric-data";
import { computeAtmosphere, type AtmosphereComputation } from "./visual-input";
import type { Frame } from "./frames";
import { atmospherePalette, skyPalette, type SkyPalette } from "./palette";
import type { PaletteEngine } from "./engine";
import { skyAt, type SkyPosition } from "./state";

/**
 * How a frame looks: the sky's colours and where the sun (or moon) sits.
 * Pure and cheap, so the browser works it out for the frame on show instead
 * of receiving it for every frame.
 */
export interface FrameLook {
  palette: SkyPalette;
  sky: SkyPosition;
  atmosphere: AtmosphereComputation["atmosphere"];
  atmosphereInputStatus: AtmosphereComputation["inputStatus"];
}

export function frameLook(f: Frame, engine: PaletteEngine = "live"): FrameLook {
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
    // The page's own palette, or (WTH-046L, behind `?motore=atmosfera`) the one worked out from the atmosphere
    palette:
      engine === "atmosphere"
        ? atmospherePalette(f.light, visual.atmosphere)
        : skyPalette({ light: f.light, state: f.state, cloudCover: f.cloudCover, uv: f.uv }),
    sky: skyAt(f.light, f.phase),
  };
}
