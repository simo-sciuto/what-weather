import type { FontRef } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));


/** Climate Crisis has one weight and one width; its one axis is YEAR */
export const DISPLAY_AXES = { wght: [400, 400], wdth: [100, 100] } as const;
export const YEAR_AXIS = [1979, 2050] as const;
/** The small notes' two weights in Schibsted Grotesk: labels, then figures */
export const MONO_WEIGHTS = [500, 700] as const;

export function clampAxes(font: FontRef): FontRef {
  if (font.family === "mono") {
    const wght = font.wght >= 450 ? MONO_WEIGHTS[1] : MONO_WEIGHTS[0];
    return { ...font, wght, wdth: 100 };
  }
  return {
    ...font,
    wght: Math.round(clamp(font.wght, ...DISPLAY_AXES.wght)),
    wdth: Math.round(clamp(font.wdth, ...DISPLAY_AXES.wdth) * 10) / 10,
    ...(font.year == null ? {} : { year: Math.round(clamp(font.year, ...YEAR_AXIS)) }),
  };
}

/** Proportions of Climate Crisis, in em: caps and figures stand this tall over the baseline */
export const CAP_HEIGHT = 0.7;
/** IBM Plex Mono's caps */
export const MONO_CAP = 0.7;

/**
 * The smallest type on the sheet: 0.0155 of the width, 38 px on the 2480 px print (9.3 pt on A4). Nothing
 * prints below it.
 */
export const MICRO_SIZE = 0.0155;
