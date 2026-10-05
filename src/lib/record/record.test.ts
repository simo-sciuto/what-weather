import { describe, expect, it } from "vitest";
import { conditionFamily } from "./condition-family";
import { compositionMode, dominantOf, getRecordComposition } from "./compose";
import { fitPlace } from "./fit";
import { weatherMetrics, recordId, formatCoord, MIN_METRICS } from "./metrics";
import { cropKm, normTemp } from "./pressure";
import { hash32, mulberry32, recordSeed } from "./seed";
import { clampAxes, DISPLAY_AXES } from "./type-system";
import { renderSvg } from "./render-svg";
import { EDGE_RECORDS, SPIKE_RECORDS } from "./fixtures/records";
import type { FontRef, Measure, RecordInput } from "./types";

/** A fixed type measure: 0.6 em per character, scaled by the width axis, plus tracking */
const measure: Measure = (text: string, f: FontRef) =>
  text.length * f.size * (f.family === "mono" ? 0.6 : 0.6 * (f.wdth / 100)) + Math.max(0, text.length - 1) * f.tracking * f.size;

const byKey = (k: string) => [...SPIKE_RECORDS, ...EDGE_RECORDS].find((r) => r.key === k)!;
const compose = (k: string, patch: Partial<RecordInput> = {}) => {
  const r = byKey(k);
  return getRecordComposition({ ...r.input, ...patch }, r.geography, measure);
};

describe("condition family", () => {
  it("maps every normalized condition, with wind taking over clear and cloud only", () => {
    expect(conditionFamily({ condition: "clear" })).toBe("CLEAR");
    expect(conditionFamily({ condition: "partly-cloudy" })).toBe("CLOUD");
    expect(conditionFamily({ condition: "cloudy" })).toBe("CLOUD");
    expect(conditionFamily({ condition: "fog" })).toBe("FOG");
    expect(conditionFamily({ condition: "drizzle" })).toBe("RAIN");
    expect(conditionFamily({ condition: "rain" })).toBe("RAIN");
    expect(conditionFamily({ condition: "thunderstorm" })).toBe("STORM");
    expect(conditionFamily({ condition: "snow" })).toBe("SNOW");
    expect(conditionFamily({ condition: "clear", windSpeed: 45 })).toBe("WIND");
    expect(conditionFamily({ condition: "cloudy", windGust: 70 })).toBe("WIND");
    expect(conditionFamily({ condition: "rain", windSpeed: 60 })).toBe("RAIN");
  });
});

describe("modes and dominance", () => {
  it("are chosen by family and temperature, never by the seed", () => {
    expect(compositionMode("CLEAR", 31)).toBe("collision");
    expect(compositionMode("CLEAR", 18)).toBe("open-atlas");
    expect(compositionMode("FOG", 8)).toBe("open-atlas");
    expect(compositionMode("RAIN", 18)).toBe("vertical-field");
    expect(compositionMode("CLOUD", 6, 92)).toBe("vertical-field");
    expect(compositionMode("CLOUD", 6, 50)).toBe("open-atlas");
    expect(compositionMode("STORM", 14)).toBe("collision");
    expect(dominantOf("collision", 41)).toBe("temperature");
    expect(dominantOf("collision", 31)).toBe("place");
    expect(dominantOf("open-atlas", -24)).toBe("temperature");
  });

  it("resolve the eight test records to the expected modes", () => {
    const modes = SPIKE_RECORDS.map((r) => getRecordComposition(r.input, r.geography, measure).metadata.mode);
    expect(modes).toEqual(["collision", "open-atlas", "vertical-field", "open-atlas", "collision", "open-atlas", "vertical-field", "collision"]);
  });
});

describe("determinism", () => {
  it("gives the same scene and seed for the same input", () => {
    expect(compose("tokyo")).toEqual(compose("tokyo"));
    expect(recordSeed("Tokyo", "2026-10-05", "RAIN")).toBe(recordSeed("Tokyo", "2026-10-05", "RAIN"));
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("keeps the major decisions when only the date changes; the seed may differ", () => {
    const a = compose("oslo");
    const b = compose("oslo", { date: "2026-11-12" });
    expect(b.metadata.seed).not.toBe(a.metadata.seed);
    for (const k of ["mode", "family", "dominant", "interplay"] as const) expect(b.metadata[k]).toBe(a.metadata[k]);
    const size = (s: typeof a) => s.layers.find((l) => l.id === "dominant")!.payload;
    expect(size(b)).toEqual(size(a));
    expect(b.metadata.recordId).toBe("WW / 2026 / 316 / OSLO");
  });

  it("hashes with FNV-1a", () => {
    expect(hash32("")).toBe(0x811c9dc5);
    expect(hash32("a")).toBe(0xe40c292c);
  });
});

describe("place fitting", () => {
  const base: FontRef = { family: "display", wght: 800, wdth: 125, size: 0.3, tracking: 0 };
  it("keeps a short name at the preferred size, never enlarged to fill", () => {
    const f = fitPlace("OSLO", { font: { ...base, size: 0.25 }, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.step).toBe("preferred");
    expect(f.font.size).toBe(0.25);
    expect(f.width).toBeLessThan(0.88);
  });

  it("narrows, wraps on whole words and stays within three lines for a long name", () => {
    const f = fitPlace("SAN CRISTOBAL DE LAS CASAS", { font: base, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.lines.length).toBeLessThanOrEqual(3);
    expect(f.lines.join(" ")).toBe("SAN CRISTOBAL DE LAS CASAS");
    expect(f.width).toBeLessThanOrEqual(0.88 + 1e-9);
    expect(f.font.wdth).toBeGreaterThanOrEqual(DISPLAY_AXES.wdth[0]);
  });

  it("never truncates a single long word: the long-name setting scales it to the measure", () => {
    const f = fitPlace("LLANFAIRPWLLGWYNGYLLGOGERYCHWYRNDROBWLL", { font: base, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.step).toBe("long-name");
    expect(f.lines).toEqual(["LLANFAIRPWLLGWYNGYLLGOGERYCHWYRNDROBWLL"]);
    expect(f.width).toBeLessThanOrEqual(0.88 + 1e-9);
  });
});

describe("font axes", () => {
  it("clamps every axis to the font's real range", () => {
    const f = clampAxes({ family: "display", wght: 1200, wdth: 40, size: 0.1, tracking: 0 });
    expect(f.wght).toBe(900);
    expect(f.wdth).toBe(62);
    expect(clampAxes({ family: "mono", wght: 700, wdth: 80, size: 0.1, tracking: 0 })).toMatchObject({ wght: 500, wdth: 100 });
  });

  it("never asks for an axis outside the range in any test record", () => {
    for (const r of [...SPIKE_RECORDS, ...EDGE_RECORDS])
      for (const l of getRecordComposition(r.input, r.geography, measure).layers)
        if (l.payload.kind === "text" && l.payload.font.family === "display") {
          expect(l.payload.font.wght).toBeGreaterThanOrEqual(100);
          expect(l.payload.font.wght).toBeLessThanOrEqual(900);
          expect(l.payload.font.wdth).toBeGreaterThanOrEqual(62);
          expect(l.payload.font.wdth).toBeLessThanOrEqual(125);
        }
  });
});

describe("metrics", () => {
  it("fills a cluster a missing reading left short, never with an empty value", () => {
    const fog = byKey("milan-no-visibility").input;
    const m = weatherMetrics("FOG", fog);
    expect(m.map((x) => x.key)).not.toContain("visibility");
    expect(m.length).toBeGreaterThanOrEqual(MIN_METRICS);
    expect(m.every((x) => x.value.length > 0)).toBe(true);
    expect(weatherMetrics("CLEAR", byKey("tshuru-no-uv").input).map((x) => x.key)).not.toContain("uv");
  });

  it("prints archival coordinates and record IDs", () => {
    expect(formatCoord(-4.4667, "lat")).toBe("04°28'S");
    expect(formatCoord(29.1, "lon")).toBe("29°06'E");
    expect(recordId("Tshuru", "2026-10-05")).toBe("WW / 2026 / 278 / TSHURU");
  });
});

describe("nodes and interplay", () => {
  it("falls back to the grid when there is no geography", () => {
    const s = compose("no-geography");
    expect(s.metadata.nodes).toEqual(["city", "grid"]);
    expect(s.metadata.interplay).toBe("none");
  });

  it("keeps to three nodes and one interplay per record, the city always among them", () => {
    for (const r of [...SPIKE_RECORDS, ...EDGE_RECORDS]) {
      const s = getRecordComposition(r.input, r.geography, measure);
      const nodes = s.layers.filter((l) => l.role === "nodes");
      expect(nodes.length).toBeLessThanOrEqual(3);
      expect(nodes.some((l) => l.id === "node-city")).toBe(true);
      expect(["through", "interleave", "none"]).toContain(s.metadata.interplay);
      const glyphCuts = s.layers.filter((l) => l.clip?.glyphsOf);
      expect(new Set(glyphCuts.map((l) => l.clip?.glyphsOf)).size).toBeLessThanOrEqual(1);
    }
  });

  it("uses the accent once", () => {
    for (const r of SPIKE_RECORDS) {
      const s = getRecordComposition(r.input, r.geography, measure);
      expect(s.layers.filter((l) => l.inkRole === "accent")).toHaveLength(1);
    }
  });
});

describe("temperature pressure", () => {
  it("normalizes and tightens the crop with the heat", () => {
    expect(normTemp(-20)).toBe(0);
    expect(normTemp(45)).toBe(1);
    expect(cropKm(0)).toBeGreaterThan(cropKm(0.5));
    expect(cropKm(0.5)).toBeGreaterThan(cropKm(1));
  });
});

describe("Swiss Flat renderer", () => {
  it("draws a scene to SVG with only the scene's four inks", () => {
    const s = compose("tshuru");
    const svg = renderSvg(s, "swiss-flat", { width: 620, height: 877 });
    expect(svg.startsWith("<svg")).toBe(true);
    const colours = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6}|rgb\([^)]*\))"/g)].map((m) => m[1]));
    colours.delete("#000"); // clip shapes
    for (const c of colours) expect(Object.values(s.inks)).toContain(c);
  });
});
