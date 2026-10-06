import type { FontRef } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));


/** Mona Sans's real axes: nothing outside them is ever asked for */
export const DISPLAY_AXES = { wght: [200, 900], wdth: [75, 125] } as const;
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

/** Proportions of Mona Sans, in em: caps and figures stand this tall over the baseline */
export const CAP_HEIGHT = 0.7;
/** IBM Plex Mono's caps */
export const MONO_CAP = 0.7;

/**
 * The smallest type on the sheet: 0.0125 of the width, 31 px on the 2480 px print (7.5 pt on A4). Nothing
 * prints below it.
 */
export const MICRO_SIZE = 0.0125;
