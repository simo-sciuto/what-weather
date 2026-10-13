import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import { buildTimeline } from "@/lib/weather/frames";
import { frameLook } from "@/lib/weather/look";
import { posterSnapshot } from "@/components/poster/usePosterSnapshot";
import { BASE_ZOOM } from "@/components/weather/map-view";
import type { Reconstruction } from "@/types/weather";
import {
  BASE_VIEW,
  CREATE_RECORD_VERSION,
  DEFAULT_DESIGN,
  createRecordOf,
  parseCreateRecord,
  serializeCreateRecord,
  sourceOf,
  type CreateRecord,
} from "./create-record";
import { weatherCredit } from "./credits";

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const RECONSTRUCTION: Reconstruction = {
  kind: "reanalysis",
  model: "era5",
  resolutionKm: 25,
  confidence: "medium",
  requestedAt: 626_655_600,
  missing: ["visibility"],
};

/** The poster's snapshot of a frame of the mock weather, as the page takes it */
async function moment(scenario: "clear" | "heavy-rain" = "clear", pick: (frames: ReturnType<typeof buildTimeline>) => ReturnType<typeof buildTimeline>["frames"][number] = (t) => t.frames[0]) {
  const data = await createMockProvider(scenario, "12:00").getByCoords(45.46, 9.19);
  const timeline = buildTimeline(data);
  const frame = pick(timeline);
  const look = frameLook(frame);
  const day = timeline.days.find((d) => d.key === frame.dayKey);
  const snap = posterSnapshot({
    place: data.place,
    frame,
    look,
    timeZone: data.timezone,
    palette: look.palette,
    options: [],
    view: { zoom: 13, pitch: 40, bearing: 90 },
    credit: weatherCredit("open-meteo"),
    day: day && { high: day.high, low: day.low, partial: day.partial },
  });
  return { snap, frame };
}

const roundTrip = (r: CreateRecord) => parseCreateRecord(serializeCreateRecord(r));

describe("CreateRecord v1", () => {
  it("takes the moment's frozen facts, its time and zone, with the default design", async () => {
    const { snap } = await moment();
    const r = createRecordOf(snap, sourceOf({ provider: "open-meteo", live: true }), NOW);
    expect(r).toMatchObject({ v: CREATE_RECORD_VERSION, at: snap.time, timeZone: snap.timeZone, fetchedAt: NOW, design: DEFAULT_DESIGN });
    expect(r.weather).toBe(snap.record);
    expect(r.source).toEqual({ provider: "open-meteo", kind: "current" });
  });

  it("draws the map from the fixed base view, whatever the page's view was (ADR-018)", async () => {
    const { snap } = await moment();
    const r = createRecordOf(snap, sourceOf({ provider: "mock", live: true }), NOW);
    expect(r.design.view).toEqual({ zoom: BASE_ZOOM, pitch: 0, bearing: 0 });
    expect(BASE_VIEW.zoom).toBe(BASE_ZOOM);
  });

  it("keeps the user's choices over the defaults, and a choice left undefined keeps its default", async () => {
    const { snap } = await moment();
    const r = createRecordOf(snap, sourceOf({ provider: "mock", live: true }), NOW, { treatment: "monochrome", format: "square" });
    expect(r.design).toEqual({ ...DEFAULT_DESIGN, treatment: "monochrome", format: "square" });
    expect(createRecordOf(snap, sourceOf({ provider: "mock", live: true }), NOW, { treatment: undefined }).design.treatment).toBe("editorial");
  });

  it("never shares its design with the defaults or another record", async () => {
    const { snap } = await moment();
    const a = createRecordOf(snap, sourceOf({ provider: "mock", live: true }), NOW);
    a.design.show.temperature = false;
    a.design.view.zoom = 15;
    expect(createRecordOf(snap, sourceOf({ provider: "mock", live: true }), NOW).design).toEqual(DEFAULT_DESIGN);
    expect(DEFAULT_DESIGN.show.temperature).toBe(true);
    expect(BASE_VIEW.zoom).toBe(BASE_ZOOM);
  });

  it("keeps a record from before 1970: the archive reaches 1940", async () => {
    const { snap } = await moment();
    // Washington, 28 August 1963, 15:00 (EDT)
    const at = Date.UTC(1963, 7, 28, 19) / 1000;
    const weather = { ...snap.record, date: "1963-08-28", time: "15:00", zone: "GMT-4" };
    const source = sourceOf({ provider: "open-meteo-archive", live: false, reconstruction: RECONSTRUCTION });
    const r = createRecordOf({ record: weather, time: at, timeZone: "America/New_York" }, source, NOW);
    expect(roundTrip(r)).toEqual({ ok: true, record: r });
  });

  describe("source", () => {
    it("is current for the live moment and forecast for any other hour", () => {
      expect(sourceOf({ provider: "openweather", live: true }).kind).toBe("current");
      expect(sourceOf({ provider: "openweather", live: false }).kind).toBe("forecast");
    });

    it("is a reconstruction for the past, with its method, model and confidence", () => {
      expect(sourceOf({ provider: "open-meteo-archive", live: true, reconstruction: RECONSTRUCTION })).toEqual({
        provider: "open-meteo-archive",
        kind: "reconstruction",
        method: "reanalysis",
        model: "era5",
        confidence: "medium",
      });
    });

    it("never passes the past for the present, nor the present for the past", () => {
      expect(() => sourceOf({ provider: "open-meteo-archive", live: false })).toThrow();
      expect(() => sourceOf({ provider: "open-meteo", live: true, reconstruction: RECONSTRUCTION })).toThrow();
    });
  });

  describe("serialization", () => {
    it("comes back the same, for a live moment and for a reconstruction", async () => {
      const { snap } = await moment("heavy-rain");
      const live = createRecordOf(snap, sourceOf({ provider: "open-meteo", live: true }), NOW);
      // A reconstruction is read after the moment it is of
      const past = createRecordOf(snap, sourceOf({ provider: "open-meteo-archive", live: false, reconstruction: RECONSTRUCTION }), snap.time + 400 * 86_400);
      expect(roundTrip(live)).toEqual({ ok: true, record: live });
      expect(roundTrip(past)).toEqual({ ok: true, record: past });
    });

    it("keeps the provenance of an interpolated hour", async () => {
      // The mock gives every hour; an hour between two of a provider's points is one it marks unmeasured
      const { snap } = await moment("clear", (t) => ({ ...t.frames.find((f, i) => i > 0 && f.measured)!, measured: false }));
      const r = createRecordOf(snap, sourceOf({ provider: "mock", live: false }), NOW);
      const back = roundTrip(r);
      expect(back.ok && back.record.weather.provenance?.interpolated).toBe(true);
    });

    it("keeps absent readings absent: a whole day carries no filler readings", async () => {
      const { snap } = await moment("clear", (t) => t.days[t.days.length - 1].overview);
      const back = roundTrip(createRecordOf(snap, sourceOf({ provider: "mock", live: false }), NOW));
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(back.record.weather.allDay).toBe(true);
      expect("feelsLike" in back.record.weather).toBe(false);
      expect("windSpeed" in back.record.weather).toBe(false);
    });

    it("is deterministic: the same moment gives the same text", async () => {
      const a = createRecordOf((await moment()).snap, sourceOf({ provider: "mock", live: true }), NOW);
      const b = createRecordOf((await moment()).snap, sourceOf({ provider: "mock", live: true }), NOW);
      expect(serializeCreateRecord(a)).toBe(serializeCreateRecord(b));
    });
  });

  describe("parsing refuses", () => {
    async function valid(): Promise<CreateRecord> {
      return createRecordOf((await moment()).snap, sourceOf({ provider: "mock", live: true }), NOW);
    }
    /** A serialized record as plain JSON, to be broken on purpose */
    type Loose = Record<string, unknown> & {
      weather: Record<string, unknown> & { place: Record<string, unknown> };
      design: Record<string, unknown>;
      source: Record<string, unknown>;
    };
    const edit = (r: CreateRecord, change: (o: Loose) => void) => {
      const o = JSON.parse(serializeCreateRecord(r));
      change(o);
      return parseCreateRecord(JSON.stringify(o));
    };

    it("a version it does not know, rather than guess", async () => {
      const r = await valid();
      expect(edit(r, (o) => (o.v = 2))).toEqual({ ok: false, reason: "v: version 2 unknown" });
      expect(edit(r, (o) => delete o.v)).toEqual({ ok: false, reason: "v: missing" });
    });

    it("malformed fields, naming the field", async () => {
      const r = await valid();
      const cases: [(o: Loose) => void, string][] = [
        [(o) => (o.weather.place.lat = 120), "weather.place.lat"],
        [(o) => (o.weather.condition = "hail"), "weather.condition"],
        [(o) => (o.weather.temp = "21"), "weather.temp"],
        [(o) => (o.weather.date = "4/10/2026"), "weather.date"],
        [(o) => (o.weather.humidity = 140), "weather.humidity"],
        [(o) => (o.weather.provenance = { estimated: ["pressure"] }), "weather.provenance.estimated.0"],
        [(o) => (o.design.format = "print"), "design.format"],
        [(o) => (o.design.treatment = "neon"), "design.treatment"],
        [(o) => (o.source = { provider: "open-meteo", kind: "reconstruction" }), "source.provider"],
        [(o) => (o.source = { provider: "open-meteo-archive", kind: "current" }), "source.provider"],
        [(o) => (o.source.kind = "observed"), "source.kind"],
      ];
      for (const [change, field] of cases) {
        const parsed = edit(r, change);
        expect(parsed.ok).toBe(false);
        expect(!parsed.ok && parsed.reason.startsWith(`${field}:`)).toBe(true);
      }
    });

    it("fields that tell different stories (rule 7)", async () => {
      const { snap } = await moment("clear", (t) => t.days[t.days.length - 1].overview);
      const day = createRecordOf(snap, sourceOf({ provider: "mock", live: false }), NOW);
      // A whole day is not the current moment
      const asCurrent = edit(day, (o) => (o.source.kind = "current"));
      expect(!asCurrent.ok && asCurrent.reason.startsWith("source.kind:")).toBe(true);

      const r = await valid();
      const ifs = { provider: "open-meteo-archive", kind: "reconstruction", method: "forecast-archive", model: "ecmwf_ifs", confidence: "high" };
      const cases: [(o: Loose) => void, string][] = [
        // The current moment is when the weather was read
        [(o) => (o.fetchedAt = (o.at as number) + 2 * 86_400), "source.kind"],
        // The printed day is the day of the moment
        [(o) => (o.weather.date = "1989-11-09"), "weather.date"],
        // A reconstruction is of the past
        [(o) => (o.source = { ...ifs, method: "reanalysis", model: "era5" }), "source.kind"],
        // The IFS archive starts in 2017
        [
          (o) => {
            Object.assign(o, { source: ifs, at: Date.UTC(1989, 10, 9, 22) / 1000, timeZone: "Europe/Berlin", fetchedAt: NOW });
            o.weather.date = "1989-11-09";
          },
          "source.method",
        ],
        // Before the archive's first year
        [(o) => (o.at = Date.UTC(1930, 0, 1) / 1000), "at"],
        // The view is fixed in v1 (ADR-018)
        [(o) => ((o.design.view as Record<string, unknown>).zoom = 15), "design.view.zoom"],
        [(o) => (o.timeZone = "Mars/Olympus"), "timeZone"],
      ];
      for (const [change, field] of cases) {
        const parsed = edit(r, change);
        expect(parsed.ok, field).toBe(false);
        expect(!parsed.ok && parsed.reason.startsWith(`${field}:`), `${field} ${!parsed.ok && parsed.reason}`).toBe(true);
      }
    });

    it("anything that is not a record, without throwing", () => {
      for (const text of ["", "x", "null", "[]", "42", '"record"', "{}", '{"v":1}'])
        expect(() => parseCreateRecord(text)).not.toThrow();
      expect(parseCreateRecord("x")).toEqual({ ok: false, reason: "not JSON" });
      expect(parseCreateRecord("[]").ok).toBe(false);
    });
  });

});
