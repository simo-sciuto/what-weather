import type { FontRef } from "./types";


/**
 * The display face is a static Helvetica in two widths: Heros Bold (100%) and Heros Condensed Bold (82%). Every
 * weight the engine asks for is set bold; every width below the midpoint takes the condensed cut.
 */
export const DISPLAY_AXES = { wght: [700, 700], wdth: [82, 100] } as const;
export const CONDENSED_BELOW = 91;
/** IBM Plex Mono, the two static weights the poster loads */
export const MONO_WEIGHTS = [400, 500] as const;

export function clampAxes(font: FontRef): FontRef {
  if (font.family === "mono") {
    const wght = font.wght >= 450 ? 500 : 400;
    return { ...font, wght, wdth: 100 };
  }
  return { ...font, wght: DISPLAY_AXES.wght[0], wdth: font.wdth < CONDENSED_BELOW ? DISPLAY_AXES.wdth[0] : DISPLAY_AXES.wdth[1] };
}

/** Proportions of Heros, in em: caps and figures stand this tall over the baseline */
export const CAP_HEIGHT = 0.7;
/** IBM Plex Mono's caps */
export const MONO_CAP = 0.7;

/**
 * The smallest type on the sheet: 0.0125 of the width, 31 px on the 2480 px print (7.5 pt on A4). Nothing
 * prints below it.
 */
export const MICRO_SIZE = 0.0125;
