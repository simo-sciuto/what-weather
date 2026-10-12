/**
 * The record's faces, self-hosted in public/fonts/record (SIL Open Font License 1.1): Syne for the large type (the
 * user's choice of 2026-10-06, after Climate Crisis read too poorly), variable on weight (400-800); Schibsted
 * Grotesk for the small notes (`mono`, a role, not a monospace).
 */

import type { FontRef, RecordScene } from "./types";

export const DISPLAY_FAMILY = "WW Record Display";
export const MONO_FAMILY = "WW Record Mono";
/** The wordmark, as on the home page (`Wordmark.tsx`): Inter Tight */
export const BRAND_FAMILY = "WW Record Brand";
export const FONT_DIR = "/fonts/record";

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

export type FontFaceSpec = { family: string; file: string; weight: string; stretch: string; unicodeRange: string };

export const RECORD_FONT_FACES: readonly FontFaceSpec[] = [
  { family: DISPLAY_FAMILY, file: "syne-400-800-latin.woff2", weight: "400 800", stretch: "100%", unicodeRange: LATIN },
  { family: DISPLAY_FAMILY, file: "syne-400-800-latin-ext.woff2", weight: "400 800", stretch: "100%", unicodeRange: LATIN_EXT },
  { family: MONO_FAMILY, file: "schibsted-grotesk-400-900-latin.woff2", weight: "400 900", stretch: "100%", unicodeRange: LATIN },
  { family: MONO_FAMILY, file: "schibsted-grotesk-400-900-latin-ext.woff2", weight: "400 900", stretch: "100%", unicodeRange: LATIN_EXT },
  { family: BRAND_FAMILY, file: "inter-tight-100-900-latin.woff2", weight: "100 900", stretch: "100%", unicodeRange: LATIN },
  { family: BRAND_FAMILY, file: "inter-tight-100-900-latin-ext.woff2", weight: "100 900", stretch: "100%", unicodeRange: LATIN_EXT },
];

const FAMILY_NAME: Record<FontRef["family"], string> = { display: DISPLAY_FAMILY, mono: MONO_FAMILY, brand: BRAND_FAMILY };

/** The family names the scene's text is set in: an exported SVG carries only those faces (WTH-206) */
export function sceneFamilies(scene: RecordScene): Set<string> {
  const out = new Set<string>();
  for (const l of scene.layers) if (l.payload.kind === "text") out.add(FAMILY_NAME[l.payload.font.family]);
  return out;
}

/**
 * The @font-face rules, each face's source from `src` (a URL for the page, a data URI inside an exported SVG).
 * `families` keeps only those family names; absent, every face.
 */
export function fontFaceCss(src: (file: string) => string, families?: ReadonlySet<string>): string {
  return RECORD_FONT_FACES.filter((f) => !families || families.has(f.family)).map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("${src(f.file)}") format("${f.file.endsWith(".otf") ? "opentype" : "woff2"}");font-weight:${f.weight};font-stretch:${f.stretch};font-style:normal;unicode-range:${f.unicodeRange};font-display:block}`,
  ).join("\n");
}
