import type { Frame } from "./frames";
import { skyPalette, type SkyPalette } from "./palette";
import { skyAt, type SkyPosition } from "./state";

/**
 * How a frame looks: the sky's colours and where the sun (or moon) sits.
 * Pure and cheap, so the browser works it out for the frame on show instead
 * of receiving it for every frame.
 */
export interface FrameLook {
  palette: SkyPalette;
  sky: SkyPosition;
}

export function frameLook(f: Pick<Frame, "light" | "phase" | "state" | "cloudCover">): FrameLook {
  return {
    palette: skyPalette({ light: f.light, state: f.state, cloudCover: f.cloudCover }),
    sky: skyAt(f.light, f.phase),
  };
}
