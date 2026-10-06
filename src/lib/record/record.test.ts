import { describe, expect, it } from "vitest";
import { createAtmosphere, type AtmosphereAxes } from "@/lib/weather/atmosphere";
import { recordMode, typeVisualState } from "@/lib/weather/typography";
import { conditionFamily } from "./condition-family";
import { getRecordComposition, nameBlocks } from "./compose";
import { fitPlace } from "./fit";
import { clipLine, clipRing, crossings } from "./geography";
import { recordInks, PAPER, RECORD_ACCENT } from "./inks";
import { formatCoord, metricsFor, recordId, temperatureWords } from "./metrics";
import { hash32, mulberry32, placeSlug, recordSeed } from "./seed";
import { clampAxes, DISPLAY_AXES } from "./type-system";
import { renderSvg } from "./render-svg";
import { EDGE_RECORDS, SPIKE_RECORDS } from "./fixtures/records";
import type { FontRef, Measure, Point, RecordInput, RecordScene } from "./types";

/** A fixed type measure: 0.6 em per character, scaled by the width axis, plus tracking */
const measure: Measure = (text: string, f: FontRef) =>
  text.length * f.size * (f.family === "mono" ? 0.6 : 0.6 * (f.wdth / 100)) + Math.max(0, text.length - 1) * f.tracking * f.size;

const ALL = [...SPIKE_RECORDS, ...EDGE_RECORDS];
const byKey = (k: string) => ALL.find((r) => r.key === k)!;
const compose = (k: string, patch: Partial<RecordInput> = {}) => {
  const r = byKey(k);
  return getRecordComposition({ ...r.input, ...patch }, r.geography, measure);
};
const axes = (a: Partial<AtmosphereAxes>): AtmosphereAxes =>
  createAtmosphere({ daylight: 1, warmth: 0, cloudiness: 0, haze: 0, wetness: 0, severity: 0, snow: 0, energy: 0, ...a });

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
    expect(conditionFamily({ condition: "rain", windSpeed: 60 })).toBe("RAIN");
  });
});

describe("type engine (typeVisualState)", () => {
  it("chooses the mode from the atmosphere", () => {
    expect(recordMode(axes({ warmth: 0.7 }))).toBe("collision");
    expect(recordMode(axes({ severity: 0.8, wetness: 0.9 }))).toBe("collision");
    expect(recordMode(axes({ wetness: 0.6, cloudiness: 1 }))).toBe("field-record");
    expect(recordMode(axes({ snow: 0.5, cloudiness: 1 }))).toBe("open-atlas");
    expect(recordMode(axes({ cloudiness: 0.95 }))).toBe("field-record");
    expect(recordMode(axes({ cloudiness: 1, haze: 1 }))).toBe("open-atlas");
  });

  it("is heavy and narrow in the heat, light and wide in the cold, within the font's axes", () => {
    const hot = typeVisualState(axes({ warmth: 1 }));
    const cold = typeVisualState(axes({ warmth: -1 }));
    expect(hot.display.weight).toBeGreaterThan(cold.display.weight);
    expect(hot.display.width).toBeLessThan(cold.display.width);
    expect(hot.bleed).toBeGreaterThan(0);
    expect(cold.bleed).toBe(0);
    for (const t of [hot, cold]) {
      expect(t.display.weight).toBeGreaterThanOrEqual(100);
      expect(t.display.weight).toBeLessThanOrEqual(900);
      expect(t.display.width).toBeGreaterThanOrEqual(62);
      expect(t.display.width).toBeLessThanOrEqual(125);
    }
    expect(typeVisualState(axes({ haze: 1 })).tone).toBeCloseTo(0.22, 2);
  });

  it("gives the hand-made posters' settings for Tshuru and Tokyo", () => {
    const tshuru = compose("tshuru").metadata;
    expect(tshuru.mode).toBe("collision");
    expect(tshuru.type.display.width).toBe(62);
    expect(Math.round(tshuru.type.display.weight)).toBe(880);
    expect(tshuru.type.scale).toBeCloseTo(0.79, 2);
    const tokyo = compose("tokyo").metadata;
    expect(tokyo.mode).toBe("field-record");
    expect(tokyo.dominant).toBe("place");
    expect(Math.abs(tokyo.type.display.weight - 835)).toBeLessThan(5);
    expect(compose("milan").metadata.mode).toBe("open-atlas");
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
    expect(b.metadata.type).toEqual(a.metadata.type);
    expect(b.metadata.recordId).toBe("WW / 2026 / 316 / OSLO");
  });

  it("hashes with FNV-1a and slugs names, Latin or not", () => {
    expect(hash32("")).toBe(0x811c9dc5);
    expect(hash32("a")).toBe(0xe40c292c);
    expect(placeSlug("San Cristóbal de las Casas")).toBe("SAN-CRISTOBAL-DE-LAS-CASAS");
    expect(placeSlug("Łódź")).toBe("LODZ");
    expect(placeSlug("東京")).toMatch(/^X[0-9A-Z]+$/);
    expect(placeSlug("東京")).not.toBe(placeSlug("大阪"));
  });
});

describe("place fitting", () => {
  const base: FontRef = { family: "display", wght: 800, wdth: 125, size: 0.25, tracking: 0 };
  it("keeps a short name at the preferred size, never enlarged to fill", () => {
    const f = fitPlace("OSLO", { font: base, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.step).toBe("preferred");
    expect(f.font.size).toBe(0.25);
  });

  it("narrows, wraps on whole words and stays within three lines for a long name", () => {
    const f = fitPlace("SAN CRISTOBAL DE LAS CASAS", { font: { ...base, size: 0.3 }, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.lines.length).toBeLessThanOrEqual(3);
    expect(f.lines.join(" ")).toBe("SAN CRISTOBAL DE LAS CASAS");
    expect(f.width).toBeLessThanOrEqual(0.88 + 1e-9);
    expect(f.font.wdth).toBeGreaterThanOrEqual(DISPLAY_AXES.wdth[0]);
  });

  it("never truncates a single long word: the long-name setting scales it to the measure", () => {
    const f = fitPlace("LLANFAIRPWLLGWYNGYLLGOGERYCHWYRNDROBWLL", { font: { ...base, size: 0.3 }, wdthMin: 62, maxWidth: 0.88, minSize: 0.1, maxLines: 3, measure });
    expect(f.step).toBe("long-name");
    expect(f.lines).toEqual(["LLANFAIRPWLLGWYNGYLLGOGERYCHWYRNDROBWLL"]);
    expect(f.width).toBeLessThanOrEqual(0.88 + 1e-9);
  });

  it("breaks a field record's name into staggered blocks, never a vertical line", () => {
    expect(nameBlocks("MILANO")).toEqual(["MI", "LA", "NO"]);
    expect(nameBlocks("TOKYO")).toEqual(["TO", "KYO"]);
    expect(nameBlocks("ULAANBAATAR")).toEqual(["ULA", "ANB", "AAT", "AR"]);
    expect(nameBlocks("RIO DE JANEIRO")).toEqual(["RIO", "DE", "JANEIRO"]);
    expect(compose("tokyo").metadata.placeFit).toBe("stair, 2 blocks");
    const s = compose("tokyo", { place: { name: "Milano", lat: 35.68, lon: 139.77 } });
    const blocks = s.layers.filter((l) => /^place(-\d+)?$/.test(l.id));
    expect(blocks.every((l) => !l.transform)).toBe(true);
    const xs = blocks.map((l) => (l.payload.kind === "text" ? l.payload.lines[0].x : 0));
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[2]).toBeGreaterThan(xs[1]);
  });
});

describe("font axes", () => {
  it("clamps every axis to the font's real range", () => {
    const f = clampAxes({ family: "display", wght: 1200, wdth: 40, size: 0.1, tracking: 0 });
    expect(f.wght).toBe(800);
    expect(f.wdth).toBe(100); // Schibsted has one width
    expect(clampAxes({ family: "mono", wght: 700, wdth: 80, size: 0.1, tracking: 0 })).toMatchObject({ wght: 700, wdth: 100 });
  });

  it("never asks for an axis outside the range in any test record", () => {
    for (const r of ALL)
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
    const m = metricsFor(["visibility", "humidity", "wind"], fog, 3, []);
    expect(m.map((x) => x.key)).not.toContain("visibility");
    expect(m).toHaveLength(3);
    expect(m.every((x) => x.value.length > 0)).toBe(true);
    const texts = compose("tshuru-no-uv").layers.flatMap((l) => (l.payload.kind === "text" ? l.payload.lines.map((x) => x.text) : []));
    expect(texts).not.toContain("UV");
    expect(texts.every((t) => t.trim().length > 0)).toBe(true);
  });

  it("prints archival coordinates, record IDs and the temperature in words", () => {
    expect(formatCoord(-4.4667, "lat")).toBe("04°28'S");
    expect(formatCoord(29.1, "lon")).toBe("29°06'E");
    expect(recordId("Tshuru", "2026-10-05")).toBe("WW / 2026 / 278 / TSHURU");
    expect(temperatureWords(31)).toBe("thirty-one");
    expect(temperatureWords(-24)).toBe("minus twenty-four");
    expect(temperatureWords(8)).toBe("eight");
    expect(temperatureWords(61)).toBe("61");
  });
});

describe("the city and the inks", () => {
  const accentLayers = (s: RecordScene) => s.layers.filter((l) => l.inkRole === "accent");

  it("marks the city once, in the one accent, tied to the type by a leader", () => {
    for (const r of ALL) {
      const s = getRecordComposition(r.input, r.geography, measure);
      expect(accentLayers(s).map((l) => l.id)).toEqual(["node-city"]);
      expect(s.layers.some((l) => l.id === "leader")).toBe(true);
      expect(s.metadata.nodes).toEqual(["city"]);
    }
  });

  it("works without geography", () => {
    const s = compose("no-geography");
    expect(s.metadata.interplay).toBe("none");
    expect(s.layers.some((l) => l.role === "linework")).toBe(false);
  });

  it("tints the paper with the warmth and keeps the accent fixed", () => {
    expect(recordInks(axes({ warmth: 1 })).paper).toBe(PAPER.warm.toLowerCase());
    expect(recordInks(axes({ warmth: -1 })).paper).toBe(PAPER.cool.toLowerCase());
    expect(recordInks(axes({ warmth: -1, haze: 1 })).paper).toBe(PAPER.haze.toLowerCase());
    expect(recordInks(axes({})).accent).toBe(RECORD_ACCENT);
  });

  it("never lays water over a minus sign", () => {
    const s = compose("reykjavik");
    const minus = s.layers.find((l) => l.id === "minus")!;
    const water = s.layers.find((l) => l.id === "water");
    expect(minus.role).toBe("type-front");
    if (water) expect(water.z).toBeLessThan(minus.z);
  });

  it("rejects a record without a name", () => {
    expect(() => compose("oslo", { place: { name: "  ", lat: 0, lon: 0 } })).toThrow();
  });
});

describe("over the site's own map: the temperature as a hole, the facts in a box (WTH-200)", () => {
  const raster = (k: string, patch: Partial<RecordInput> = {}) => {
    const r = byKey(k);
    return getRecordComposition({ ...r.input, ...patch }, r.geography, measure, undefined, "raster");
  };
  const texts = (s: RecordScene) => s.layers.flatMap((l) => (l.payload.kind === "text" ? l.payload.lines.map((x) => x.text) : []));

  it("sets the temperature across the sheet as a hole in the map (paper ground, inner shadow), under the strong lines", () => {
    for (const k of ["milan", "tshuru", "tokyo", "san-cristobal"]) {
      const s = raster(k);
      expect(s.metadata.placeFit).toMatch(/^hole/);
      const dom = s.layers.find((l) => l.id === "dominant")!;
      expect(dom.inkRole).toBe("hole");
      expect(dom.inset).toBe(true);
      expect(s.inks.hole).not.toBe("#ffffff");
      // Wider than the sheet: a decoration, not a figure
      if (dom.payload.kind === "text") expect(measure(dom.payload.lines[0].text, dom.payload.font)).toBeGreaterThan(1);
      const cut = s.layers.find((l) => l.id === "map-cut")!;
      expect(cut.clip?.glyphsOf).toEqual(["dominant", "place"]);
      expect(cut.z).toBeGreaterThan(dom.z);
    }
  });

  it("gathers the facts as a block on the grid with no fill or border, and the record's ID up the right edge", () => {
    const s = raster("tokyo", { place: { name: "Tokyo", lat: 35.68, lon: 139.77, region: "Tokyo", country: "Giappone" } });
    expect(s.layers.some((l) => l.id.startsWith("box-"))).toBe(false);
    const all = texts(s);
    for (const t of ["RAIN", "Tokyo, GIAPPONE", "© MAPBOX © OPENSTREETMAP"]) expect(all).toContain(t);
    const edge = s.layers.find((l) => l.id === "record-id")!;
    expect(edge.transform?.rotate).toBe(-90);
    expect(all.join(" ")).toContain("WW / 2026 / 278 / TOKYO");
    // Only the name and the temperature take the large face
    for (const l of s.layers)
      if (l.payload.kind === "text" && l.payload.font.family === "display") expect(["dominant", "place"]).toContain(l.id);
  });

  it("sets the home page's wordmark: what, a butter bar, weather", () => {
    const s = raster("oslo");
    expect(s.layers.find((l) => l.id === "wordmark-what")!.payload).toMatchObject({ kind: "text", font: { family: "brand", wght: 300 } });
    expect(s.layers.find((l) => l.id === "wordmark-weather")!.payload).toMatchObject({ kind: "text", font: { family: "brand", wght: 800 } });
    const bar = s.layers.find((l) => l.id === "wordmark-bar")!;
    expect(bar.inkRole).toBe("brand");
    expect(s.inks.brand).toBe("#f9e8a7");
  });

  it("takes its colours from the app's colour study", () => {
    const s = raster("tokyo");
    expect(s.inks.accent).toBe(RECORD_ACCENT);
    expect(s.inks["ink-2"]).toBe("#b3e9c4"); // tempColor(18): rgb(179 233 196)
    expect(s.layers.find((l) => l.id === "place")!.inkRole).toBe("ink-2");
  });

  it("fits a long name on two lines at the foot", () => {
    const place = raster("san-cristobal").layers.find((l) => l.id === "place")!.payload;
    expect(place.kind === "text" && place.lines.length).toBeLessThanOrEqual(2);
    expect(place.kind === "text" && place.lines.map((l) => l.text).join(" ")).toBe("SAN CRISTOBAL DE LAS CASAS");
  });

  it("puts the pictures it is given into the SVG", () => {
    const svg = renderSvg(raster("oslo"), "swiss-flat", { width: 620, height: 877, images: { map: "data:image/png;base64,AA==", "map-cut": "data:image/png;base64,BB==" } });
    expect(svg).toContain('href="data:image/png;base64,AA=="');
    expect(svg).toContain('href="data:image/png;base64,BB=="');
    expect(svg).toContain("WW Record Brand");
    expect(svg).toContain('tableValues="1 0"'); // the hole's inner shadow
  });
});

describe("geography", () => {
  const box = { x: 0, y: 0, w: 1, h: 1 };
  it("cuts lines and rings at the slot and finds crossings", () => {
    const l: Point[] = [
      [-1, 0.5],
      [0.5, 0.5],
      [2, 0.5],
    ];
    expect(clipLine(l, box)).toEqual([
      [
        [0, 0.5],
        [0.5, 0.5],
        [1, 0.5],
      ],
    ]);
    const ring = clipRing(
      [
        [-1, -1],
        [0.5, -1],
        [0.5, 0.5],
        [-1, 0.5],
      ],
      box,
    );
    expect(ring.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
    const placed = { coast: [l], border: [], river: [], water: [] };
    expect(crossings(placed, "coast", [0.3, 0], [0.3, 1])).toEqual([[0.3, 0.5]]);
  });
});

describe("Swiss Flat renderer", () => {
  it("draws a scene to SVG with only the scene's four inks", () => {
    const s = compose("tshuru");
    const svg = renderSvg(s, "swiss-flat", { width: 620, height: 877 });
    expect(svg.startsWith("<svg")).toBe(true);
    const colours = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase()));
    const inks = Object.values(s.inks).map((c) => c.toLowerCase());
    for (const c of colours) expect(inks).toContain(c);
  });
});
