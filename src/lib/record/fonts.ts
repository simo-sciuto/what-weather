/**
 * The record's faces, self-hosted in public/fonts/record (SIL Open Font License 1.1): Mona Sans, a neo-grotesk
 * in the Helvetica line, variable on weight (200-900) and width (75-125%), for the display type, chosen on
 * 2026-10-06 after a side-by-side test; IBM Plex Mono for the micro type.
 */
export const DISPLAY_FAMILY = "WW Record Display";
export const MONO_FAMILY = "WW Record Mono";
export const FONT_DIR = "/fonts/record";

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

export type FontFaceSpec = { family: string; file: string; weight: string; stretch: string; unicodeRange: string };

export const RECORD_FONT_FACES: readonly FontFaceSpec[] = [
  { family: DISPLAY_FAMILY, file: "mona-sans-200-900-latin.woff2", weight: "200 900", stretch: "75% 125%", unicodeRange: LATIN },
  { family: DISPLAY_FAMILY, file: "mona-sans-200-900-latin-ext.woff2", weight: "200 900", stretch: "75% 125%", unicodeRange: LATIN_EXT },
  { family: MONO_FAMILY, file: "ibm-plex-mono-400-latin.woff2", weight: "400", stretch: "100%", unicodeRange: LATIN },
  { family: MONO_FAMILY, file: "ibm-plex-mono-400-latin-ext.woff2", weight: "400", stretch: "100%", unicodeRange: LATIN_EXT },
  { family: MONO_FAMILY, file: "ibm-plex-mono-500-latin.woff2", weight: "500", stretch: "100%", unicodeRange: LATIN },
  { family: MONO_FAMILY, file: "ibm-plex-mono-500-latin-ext.woff2", weight: "500", stretch: "100%", unicodeRange: LATIN_EXT },
];

/** The @font-face rules, each face's source from `src` (a URL for the page, a data URI inside an exported SVG) */
export function fontFaceCss(src: (file: string) => string): string {
  return RECORD_FONT_FACES.map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("${src(f.file)}") format("${f.file.endsWith(".otf") ? "opentype" : "woff2"}");font-weight:${f.weight};font-stretch:${f.stretch};font-style:normal;unicode-range:${f.unicodeRange};font-display:block}`,
  ).join("\n");
}
