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

  it("marks an interpolated hour's figures as approximate, never the provider's own range", () => {
    const r = { ...byKey("milan-no-visibility").input, high: 21, low: 15, provenance: { interpolated: true } };
    const m = metricsFor(["temp", "feels", "range"], r, 3, []);
    expect(m.find((x) => x.key === "temp")?.value).toBe(`~${Math.round(r.temp)}°`);
    expect(m.find((x) => x.key === "range")?.value).toBe("21° / 15°");
    expect(metricsFor(["temp"], { ...r, provenance: undefined }, 1, [])[0].value).not.toMatch(/^~/);
  });

  it("never prints a partial day's range or estimated air as readings", () => {
    const base = { ...byKey("milan-no-visibility").input, high: 21, low: 15, humidity: 80, visibility: 4 };
    const keys = (r: RecordInput) => metricsFor(["range", "humidity", "visibility"], r, 5, []).map((x) => x.key);
    expect(keys(base)).toEqual(expect.arrayContaining(["range", "humidity", "visibility"]));
    const shown = keys({ ...base, provenance: { partialRange: true, estimated: ["humidity", "visibility"] } });
    expect(shown).not.toContain("range");
    expect(shown).not.toContain("humidity");
    expect(shown).not.toContain("visibility");
    // A whole day whose range is partial has no high of its own to print either
    const allDay = metricsFor(["temp"], { ...base, allDay: true, provenance: { partialRange: true } }, 5, []);
    expect(allDay.map((x) => x.key)).not.toContain("temp");
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

describe("over the site's own map: the name as a hole on the grid, the facts in a block (WTH-200)", () => {
  const raster = (k: string, patch: Partial<RecordInput> = {}) => {
    const r = byKey(k);
    return getRecordComposition({ ...r.input, ...patch }, r.geography, measure, undefined, "raster");
  };
  const texts = (s: RecordScene) => s.layers.flatMap((l) => (l.payload.kind === "text" ? l.payload.lines.map((x) => x.text) : []));

  it("leaves the large temperature out: the name alone is the large type, a hole lit from under the map", () => {
    for (const k of ["milan", "tshuru", "tokyo", "san-cristobal"]) {
      const s = raster(k);
      expect(s.layers.some((l) => l.id === "dominant" || l.id === "degree")).toBe(false);
      expect(s.layers.some((l) => l.payload.kind === "text" && l.payload.font.family === "display")).toBe(false);
      const place = s.layers.find((l) => l.id === "place")!;
      expect(place.payload.kind === "text" && place.payload.font.family).toBe("brand");
      expect(place.inkRole).toBe("ink-2");
      expect(place.inset).toBe(true);
      expect(place.glow).toBe(true);
      expect(place.payload.kind === "text" && place.payload.stroke).toBeFalsy();
      expect(place.transform).toBeUndefined();
      const cut = s.layers.find((l) => l.id === "map-cut")!;
      expect(cut.clip?.glyphsOf).toEqual(["place"]);
      expect(cut.z).toBeGreaterThan(place.z);
      // No veil behind the name: it read as a band of light over a dark sea
      expect(s.layers.some((l) => l.payload.kind === "shade")).toBe(false);
    }
  });

  it("keeps the temperature among the facts, with no fill or border, and the ID up the right edge", () => {
    const s = raster("tokyo", { place: { name: "Tokyo", lat: 35.68, lon: 139.77, region: "Tokyo", country: "Giappone" } });
    const all = texts(s);
    for (const t of ["RAIN", "TEMP", "18°", "Tokyo, GIAPPONE", "© MAPBOX © OPENSTREETMAP"]) expect(all).toContain(t);
    expect(s.layers.some((l) => l.id.startsWith("box-"))).toBe(false);
    expect(s.layers.find((l) => l.id === "record-id")!.transform?.rotate).toBe(-90);
    expect(all.join(" ")).toContain("WW / 2026 / 278 / TOKYO");
  });

  it("marks the city with a red ring and a white line out to its coordinates", () => {
    const s = raster("oslo");
    const node = s.layers.find((l) => l.id === "node-city")!;
    expect(node.payload).toMatchObject({ kind: "node", shape: "ring" });
    expect(node.inkRole).toBe("accent");
    expect(s.layers.find((l) => l.id === "leader")!.inkRole).toBe("ink-1");
    expect(texts(s)).toContain("59°55'N  10°45'E");
    // The region and the country just above the coordinates
    const where = raster("oslo", { place: { name: "Oslo", lat: 59.91, lon: 10.75, region: "Oslo", country: "Norvegia" } });
    const w = where.layers.find((l) => l.id === "where")!.payload;
    const c = where.layers.find((l) => l.id === "city-coords")!.payload;
    if (w.kind === "text" && c.kind === "text") {
      expect(w.lines[0].text).toBe("Oslo, NORVEGIA");
      expect(w.lines[0].x).toBeCloseTo(c.lines[0].x, 6);
      expect(w.lines[0].y).toBeLessThan(c.lines[0].y);
    }
  });

  it("places the name on the grid in one of five ways, chosen by the seed only", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      const date = `2026-10-${String(d).padStart(2, "0")}`;
      const s = raster("oslo", { date });
      seen.add(s.metadata.placeFit.split(",")[0]);
      expect(raster("oslo", { date })).toEqual(s);
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const p of seen) expect(p).toMatch(/^hole [0-4]$/);
  });

  it("keeps the name on the sheet and clear of the city on every format and every placement (WTH-200)", () => {
    const formats = [
      { width: 2480, height: 3508 },
      { width: 1440, height: 2560 },
      { width: 2400, height: 2400 },
    ];
    const names = ["Bo", "La Paz", "Al Ain", "Oslo", "Reggio nell'Emilia", "Llanfairpwllgwyngyll", "Paraty", "Yogyakarta", "Şanlıurfa"];
    const r = byKey("oslo");
    for (const canvas of formats) {
      const aspect = canvas.height / canvas.width;
      const seen = new Set<string>();
      for (const name of names)
        for (let d = 1; d <= 20; d++) {
          const date = `2026-10-${String(d).padStart(2, "0")}`;
          const s = getRecordComposition({ ...r.input, date, place: { ...r.input.place, name } }, null, measure, canvas, "raster");
          seen.add(s.metadata.placeFit.split(",")[0]);
          const at = `${canvas.width}x${canvas.height} ${name} ${date} ${s.metadata.placeFit}`;
          const place = s.layers.find((l) => l.id === "place")!.payload;
          if (place.kind !== "text") throw new Error(at);
          // Sizes are of the width, positions of the height: the cap height and the tails in the height's terms
          const cap = (0.72 * place.font.size) / aspect;
          const last = place.lines.at(-1)!;
          const tail = /[gjpqyQJ,;çşţęąįųÇŞŢĘĄĮŲ]/.test(last.text) ? (0.24 * place.font.size) / aspect : 0;
          const top = place.lines[0].y - cap;
          const foot = last.y + tail;
          const mark = s.layers.find((l) => l.id === "wordmark-what")!.payload;
          if (mark.kind !== "text") throw new Error(at);
          expect(top, at).toBeGreaterThan(0);
          expect(foot, at).toBeLessThan(mark.lines[0].y - (0.72 * mark.font.size) / aspect);
          // The box the legibility budget measures is where the letters are
          expect(s.metadata.nameBox!.y, at).toBeCloseTo(top, 6);
          expect(s.metadata.nameBox!.y + s.metadata.nameBox!.height, at).toBeCloseTo(place.lines.at(-1)!.y, 6);
          // The city's ring, its region and its coordinates stay out of the name's band
          const coords = s.layers.find((l) => l.id === "city-coords")!.payload;
          if (coords.kind !== "text") throw new Error(at);
          // The mark reaches 30 above the city (the region's line) and 16 under it (the coordinates), on the width's scale
          const [up, down] = [30 / 600 / aspect, 16 / 600 / aspect];
          const city = s.metadata.cityAt[1];
          expect(city + down < top || city - up > foot, at).toBe(true);
          for (const y of [coords.lines[0].y, s.layers.find((l) => l.id === "where")?.payload.kind === "text" ? (s.layers.find((l) => l.id === "where")!.payload as { lines: { y: number }[] }).lines[0].y : city])
            expect(y < top || y > foot, at).toBe(true);
        }
      expect(seen.size).toBe(5);
    }
  });

  it("sets the home page's wordmark: what, a butter bar, weather", () => {
    const s = raster("oslo");
    expect(s.layers.find((l) => l.id === "wordmark-what")!.payload).toMatchObject({ kind: "text", font: { family: "brand", wght: 300 } });
    expect(s.layers.find((l) => l.id === "wordmark-weather")!.payload).toMatchObject({ kind: "text", font: { family: "brand", wght: 800 } });
    expect(s.layers.find((l) => l.id === "wordmark-bar")!.inkRole).toBe("brand");
    expect(s.inks.brand).toBe("#f9e8a7");
    expect(s.inks.accent).toBe(RECORD_ACCENT);
  });

  it("offers the facts several free cells and takes the one asked for, the name and the city untouched", () => {
    const a = raster("oslo");
    const slots = a.metadata.factsSlots!;
    expect(slots.length).toBeGreaterThan(1);
    const b = getRecordComposition(byKey("oslo").input, null, measure, undefined, "raster", { factsAt: 1 });
    const x = (s: RecordScene) => (s.layers.find((l) => l.id === "condition")!.payload as { lines: { x: number }[] }).lines[0].x;
    expect(x(b)).toBeCloseTo(slots[1].x + 12 / 600, 6);
    expect(b.metadata.cityAt).toEqual(a.metadata.cityAt);
    expect(b.layers.find((l) => l.id === "place")).toEqual(a.layers.find((l) => l.id === "place"));
  });

  it("gives the name's box, for keeping the marks laid over it few enough to read", () => {
    const s = raster("oslo");
    const box = s.metadata.nameBox!;
    expect(box.width).toBeGreaterThan(0.3);
    expect(box.height).toBeGreaterThan(0.02);
    expect(box.y + box.height).toBeLessThanOrEqual(1);
  });

  it("keeps a long name whole on at most three lines", () => {
    const place = raster("san-cristobal").layers.find((l) => l.id === "place")!.payload;
    expect(place.kind === "text" && place.lines.length).toBeLessThanOrEqual(3);
    expect(place.kind === "text" && place.lines.map((l) => l.text).join(" ")).toBe("San Cristobal de las Casas");
  });

  it("sets the name in Inter Tight, spelt as written, and large", () => {
    const place = raster("oslo").layers.find((l) => l.id === "place")!.payload;
    expect(place.kind === "text" && place.lines[0].text).toBe("Oslo");
    expect(place.kind === "text" && place.font.family).toBe("brand");
    expect(place.kind === "text" && place.font.size).toBeGreaterThan(0.2);
  });

  it("puts the pictures it is given into the SVG, with the hole's shadow and the brand face", () => {
    const svg = renderSvg(raster("oslo"), "swiss-flat", { width: 620, height: 877, images: { map: "data:image/png;base64,AA==", "map-cut": "data:image/png;base64,BB==" } });
    expect(svg).toContain('href="data:image/png;base64,AA=="');
    expect(svg).toContain('href="data:image/png;base64,BB=="');
    expect(svg).toContain("WW Record Brand");
    expect(svg).toContain('tableValues="1 0"');
    expect(svg).not.toMatch(/scale\(/);
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
