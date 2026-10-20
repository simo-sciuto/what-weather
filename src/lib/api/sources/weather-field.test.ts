import { describe, expect, it, vi } from "vitest";
import { FIELD_MAX_POINTS } from "@/constants/atlas";
import { latticeFor } from "@/lib/atlas/lattice";
import { fetchField, parseField, sampleField, solarLight } from "./weather-field";

/* ADR-026: the weather field's source, with Open-Meteo's multi-point answer as it writes it. No network. */

const LATTICE = { step: 4, lats: [44, 48], lons: [8, 12] };
const NOON = 1_760_000_000;
const place = (temp: number, code: number, cloud: number, precip = 0) => ({
  current: { time: NOON, temperature_2m: temp, cloud_cover: cloud, precipitation: precip, weather_code: code },
  daily: { sunrise: [NOON - 21_600], sunset: [NOON + 21_600] },
});
// south west, south east, north west, north east
const ANSWER = [place(19, 0, 5), place(21, 1, 10), place(12, 61, 100, 1.2), place(14, 3, 90)];

describe("solar light", () => {
  it("is the palette's scale: 0 at sunrise, 1 at sunset, below and above it in the twilight", () => {
    expect(solarLight(100, 100, 200)).toBe(0);
    expect(solarLight(200, 100, 200)).toBe(1);
    expect(solarLight(150, 100, 200)).toBe(0.5);
    expect(solarLight(0, 100, 200)).toBeLessThan(0);
    expect(solarLight(0, 100, 200)).toBeGreaterThanOrEqual(-1);
    expect(solarLight(900_000, 100, 200)).toBe(2);
  });
  it("has no sun times at the poles: dark or midday-ish, as the page has it", () => {
    expect(solarLight(5, null, null)).toBe(0.45);
    expect(solarLight(5, undefined, undefined, true)).toBe(-1);
  });
});

describe("parseField", () => {
  it("is one colour and one temperature per place, in the lattice's order", () => {
    const field = parseField(ANSWER, LATTICE);
    expect(field).toMatchObject({ step: 4, lats: [44, 48], lons: [8, 12], provider: "open-meteo", time: NOON, temps: [19, 21, 12, 14] });
    expect(field.colors).toHaveLength(4);
    for (const c of field.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives two places two colours when their weather differs: the clear south and the rainy north", () => {
    const [sw, , nw] = parseField(ANSWER, LATTICE).colors;
    expect(sw).not.toBe(nw);
  });

  it("is an error, not a half field, for an answer that is not the lattice", () => {
    expect(() => parseField(ANSWER.slice(0, 3), LATTICE)).toThrow(/incomplete/);
    expect(() => parseField({ error: true }, LATTICE)).toThrow();
    expect(() => parseField(ANSWER.map(() => ({})), LATTICE)).toThrow(/no reading/);
  });

  it("fills a place with no reading from its neighbours' temperature, and does not throw", () => {
    const holes = [place(19, 0, 5), {}, place(12, 61, 100), place(14, 3, 90)];
    const field = parseField(holes, LATTICE);
    expect(field.colors).toHaveLength(4);
    expect(field.temps[1]).toBe(19);
  });
});

describe("fetchField", () => {
  const ok = (body: unknown, status = 200) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it("asks Open-Meteo once, for every place of the lattice in order, for the current weather and the sun", async () => {
    const fetchImpl = ok(ANSWER);
    const field = await fetchField(LATTICE, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("44,44,48,48");
    expect(url.searchParams.get("longitude")).toBe("8,12,8,12");
    expect(url.searchParams.get("current")).toContain("temperature_2m");
    expect(url.searchParams.get("daily")).toBe("sunrise,sunset");
    expect(field.temps).toEqual([19, 21, 12, 14]);
  });

  it("never asks for more places than the cap, whatever view the lattice came from", async () => {
    for (const box of [{ west: -180, south: -85, east: 180, north: 85 }, { west: 6, south: 36, east: 19, north: 47 }, { west: 7.6, south: 45, east: 7.8, north: 45.2 }]) {
      const lattice = latticeFor(box);
      const answer = Array.from({ length: lattice.lats.length * lattice.lons.length }, () => place(15, 0, 10));
      const fetchImpl = ok(answer);
      await fetchField(lattice, fetchImpl);
      const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
      expect(url.searchParams.get("latitude")!.split(",").length).toBeLessThanOrEqual(FIELD_MAX_POINTS);
    }
  });

  it("fails on a refusal, with the status", async () => {
    await expect(fetchField(LATTICE, ok({ reason: "limit" }, 429))).rejects.toMatchObject({ message: expect.stringContaining("429") });
  });
});

describe("sampleField", () => {
  const lattice = latticeFor({ west: 6, south: 36, east: 19, north: 47 });
  const field = sampleField(lattice);

  it("is a whole field, labelled as the sample, the same every time", () => {
    expect(field.provider).toBe("mock");
    expect(field.colors).toHaveLength(lattice.lats.length * lattice.lons.length);
    expect(sampleField(lattice)).toEqual(field);
  });

  it("is cooler to the north and has weather that differs from place to place", () => {
    const cols = lattice.lons.length;
    expect(field.temps[(lattice.lats.length - 1) * cols]).toBeLessThan(field.temps[0]);
    expect(new Set(field.colors).size).toBeGreaterThan(3);
  });
});

describe("the field's hours (WTH-345)", () => {
  const H = 3600;
  const hourly = (temps: number[], codes: number[]) => ({
    time: temps.map((_, i) => NOON - 2 * H + i * H),
    temperature_2m: temps,
    cloud_cover: temps.map(() => 0),
    precipitation: temps.map(() => 0),
    weather_code: codes,
  });
  const withHours = ANSWER.map((p, i) => ({
    ...p,
    daily: { time: [NOON - 43_200], sunrise: [NOON - 21_600], sunset: [NOON + 21_600] },
    hourly: hourly([10 + i, 12 + i, 14 + i, 30 + i, 5 + i], [0, 0, 0, 0, 61]),
  }));

  it("keeps the hour that holds now and those after it, each with a colour per place in the lattice's order", () => {
    const field = parseField(withHours, LATTICE);
    expect(field.hours?.map((h) => h.time)).toEqual([NOON, NOON + H, NOON + 2 * H]);
    for (const h of field.hours ?? []) expect(h.colors).toHaveLength(4);
  });

  it("colours an hour by its own weather: a hot hour is not a cold one, and the hours differ from now when the weather does", () => {
    const field = parseField(withHours, LATTICE);
    const [now, hot, cold] = field.hours ?? [];
    expect(hot.colors[0]).not.toBe(now.colors[0]);
    expect(cold.colors[0]).not.toBe(hot.colors[0]);
  });

  it("has no hours when the answer carries none, as an older one", () => {
    expect(parseField(ANSWER, LATTICE).hours).toEqual([]);
  });

  it("asks for the hours of three days, beside now and the sun", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify(withHours))));
    await fetchField(LATTICE, fetchImpl);
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("hourly")).toContain("temperature_2m");
    expect(url.searchParams.get("forecast_days")).toBe("3");
  });

  it("the sample field has three days of hours, whole", () => {
    const field = sampleField(latticeFor({ west: 6, south: 44, east: 10, north: 47 }));
    expect(field.hours).toHaveLength(72);
    for (const h of field.hours ?? []) expect(h.colors).toHaveLength(field.lats.length * field.lons.length);
  });
});
