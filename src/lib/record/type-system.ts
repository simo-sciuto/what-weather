import { clamp, lerp } from "./pressure";
import type { ConditionFamily, FontRef } from "./types";

/** Archivo's real axes (the variable font in public/fonts/record): nothing outside them is ever asked for */
export const DISPLAY_AXES = { wght: [100, 900], wdth: [62, 125] } as const;
/** IBM Plex Mono, the two static weights the poster loads */
export const MONO_WEIGHTS = [400, 500] as const;

export function clampAxes(font: FontRef): FontRef {
  if (font.family === "mono") {
    const wght = font.wght >= 450 ? 500 : 400;
    return { ...font, wght, wdth: 100 };
  }
  return {
    ...font,
    wght: Math.round(clamp(font.wght, ...DISPLAY_AXES.wght)),
    wdth: Math.round(clamp(font.wdth, ...DISPLAY_AXES.wdth) * 10) / 10,
  };
}

/** How each family sets its type: weight across the temperature's pressure, width, tracking (em) */
type FamilyType = { wght: readonly [number, number]; wdth: number; wdthMin: number; tracking: number };

export const FAMILY_TYPE: Record<ConditionFamily, FamilyType> = {
  CLEAR: { wght: [520, 860], wdth: 125, wdthMin: 88, tracking: -0.01 },
  CLOUD: { wght: [480, 640], wdth: 100, wdthMin: 75, tracking: -0.015 },
  FOG: { wght: [260, 360], wdth: 118, wdthMin: 90, tracking: 0.05 },
  RAIN: { wght: [600, 760], wdth: 68, wdthMin: 62, tracking: -0.015 },
  STORM: { wght: [820, 900], wdth: 70, wdthMin: 62, tracking: -0.03 },
  SNOW: { wght: [220, 320], wdth: 125, wdthMin: 100, tracking: 0.07 },
  WIND: { wght: [600, 760], wdth: 112, wdthMin: 75, tracking: 0 },
};

/** The display face of the dominant element: family behaviour, the temperature on the weight, humidity on the tracking */
export function dominantFont(family: ConditionFamily, pressure: number, humidity: number | undefined, size: number): FontRef {
  const f = FAMILY_TYPE[family];
  // Humidity loosens or tightens the tracking inside a narrow band only
  const wet = humidity == null ? 0 : clamp((humidity - 50) / 50, -1, 1) * 0.008;
  return clampAxes({
    family: "display",
    wght: lerp(f.wght[0], f.wght[1], pressure),
    wdth: f.wdth,
    size,
    tracking: f.tracking - wet,
  });
}

/** Proportions of Archivo, in em: caps and figures stand this tall over the baseline */
export const CAP_HEIGHT = 0.7;
/** IBM Plex Mono's caps */
export const MONO_CAP = 0.7;

/**
 * The smallest type on the sheet: 0.0125 of the width, 31 px on the 2480 px print (7.5 pt on A4). Nothing
 * prints below it.
 */
export const MICRO_SIZE = 0.0125;
