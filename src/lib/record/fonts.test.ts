import { describe, expect, it } from "vitest";
import { getRecordComposition } from "./compose";
import { EDGE_RECORDS, SPIKE_RECORDS } from "./fixtures/records";
import { BRAND_FAMILY, DISPLAY_FAMILY, MONO_FAMILY, fontFaceCss, sceneFamilies } from "./fonts";
import type { FontRef, Measure, RecordScene } from "./types";

/** The same fixed measure as the record tests: 0.6 em a character, scaled by the width axis */
const measure: Measure = (text: string, f: FontRef) =>
  text.length * f.size * (f.family === "mono" ? 0.6 : 0.6 * (f.wdth / 100)) + Math.max(0, text.length - 1) * f.tracking * f.size;

/** The poster's own composition: raster map, its canvas size (see render-poster.ts) */
const poster = (r: (typeof SPIKE_RECORDS)[number]): RecordScene =>
  getRecordComposition(r.input, null, measure, { width: 2480, height: 3508 }, "raster");

describe("the faces an exported SVG carries (WTH-206)", () => {
  it("names only the families the scene sets its text in", () => {
    for (const r of [...SPIKE_RECORDS, ...EDGE_RECORDS]) {
      const families = sceneFamilies(poster(r));
      expect(families.size).toBeGreaterThan(0);
      for (const f of families) expect([DISPLAY_FAMILY, MONO_FAMILY, BRAND_FAMILY]).toContain(f);
    }
  });

  it("keeps only the faces of the families asked for", () => {
    const css = fontFaceCss((file) => file, new Set([BRAND_FAMILY]));
    expect(css).toContain(`font-family:"${BRAND_FAMILY}"`);
    expect(css).not.toContain(`font-family:"${DISPLAY_FAMILY}"`);
    expect(css).not.toContain(`font-family:"${MONO_FAMILY}"`);
  });

  it("carries every face when no families are given", () => {
    const css = fontFaceCss((file) => file);
    for (const f of [DISPLAY_FAMILY, MONO_FAMILY, BRAND_FAMILY]) expect(css).toContain(`font-family:"${f}"`);
  });
});
