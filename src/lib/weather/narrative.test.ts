import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLACE } from "./constants";
import { buildTimeline } from "./frames";
import { MOCK_SCENARIOS, createMockProvider, type MockScenario } from "@/lib/api/providers/mock";
import { buildNarrative } from "./narrative";
import type { WeatherData } from "@/types/weather";

/**
 * The generated Italian: the outlook under the temperature, the sentence for
 * each hour of the timeline and the one for each day. The sample provider
 * covers every kind of weather; the clock is fixed so its output is stable.
 */

const TIMES = ["05:30", "08:30", "13:00", "17:40", "22:30"];

async function sample(scenario: MockScenario, at: string): Promise<WeatherData> {
  return createMockProvider(scenario, at).getByCoords(DEFAULT_PLACE.lat, DEFAULT_PLACE.lon);
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

/** What every sentence the app writes must look like. */
function expectWellFormed(sentence: string, where: string) {
  const problems = [
    !/^[A-ZÀ-Ý]/.test(sentence) && "does not start with a capital",
    !sentence.endsWith(".") && "does not end with a full stop",
    sentence.includes("—") && "contains an em dash",
    /undefined|NaN|null|\[object/.test(sentence) && "leaks a programming value",
    /\s{2}|\s[,.:]/.test(sentence) && "has stray spacing",
    /\balle 1\b|\bverso le 1\b|\ble 0\b/.test(sentence) && "says an hour the way nobody says it",
  ].filter(Boolean);
  expect(problems, `${where}: “${sentence}”`).toEqual([]);
}

describe("every generated sentence", () => {
  it.each(MOCK_SCENARIOS)("%s: outlook, hours and days are well formed", async (scenario) => {
    for (const at of TIMES) {
      const d = await sample(scenario, at);
      expectWellFormed(buildNarrative(d), `${scenario} ${at} outlook`);
      const timeline = buildTimeline(d);
      for (const f of timeline.frames) expectWellFormed(f.summary, `${scenario} ${at} frame ${f.timeLabel}`);
      for (const day of timeline.days) expectWellFormed(day.summary, `${scenario} ${at} day ${day.name}`);
    }
  });
});

describe("the outlook", () => {
  it.each<[MockScenario, string, string]>([
    ["clear", "22:30", "Notte limpida. Minima 15° verso le 3."],
    ["clear", "17:40", "Sole fino al tramonto. Stanotte scende a 15°."],
    ["partly-cloudy", "08:30", "Sole e qualche nuvola. Massima 24° verso le 15."],
    ["cloudy", "22:30", "Notte nuvolosa."],
    ["heavy-rain", "08:30", "Piove forte almeno fino a stasera."],
    ["snow", "22:30", "Nevica almeno fino a domani mattina."],
    ["fog", "08:30", "Nebbia fino a mezzogiorno. Aria scarsa: meglio limitare lo sport all’aperto."],
    ["storm", "22:30", "Temporale in corso. Tregua verso l’una. Raffiche fino a 72 km/h."],
    ["smog", "22:30", "Minima 7° verso le 3. Aria inquinata: poco sport all’aperto."],
  ])("%s at %s", async (scenario, at, expected) => {
    expect(buildNarrative(await sample(scenario, at))).toBe(expected);
  });

  it("never reads a small-hours low as lunchtime", async () => {
    // At 13:00 a low around 1 at night is "stanotte", not "verso l’una".
    const text = buildNarrative(await sample("clear", "13:00"));
    expect(text).not.toMatch(/verso l’una/);
  });

  it("keeps the full matrix stable", async () => {
    const matrix: Record<string, string> = {};
    for (const scenario of MOCK_SCENARIOS) {
      for (const at of TIMES) matrix[`${scenario} ${at}`] = buildNarrative(await sample(scenario, at));
    }
    expect(matrix).toMatchSnapshot();
  });
});

describe("the timeline sentences", () => {
  it("compare an hour with now and name the extremes", async () => {
    const { frames } = buildTimeline(await sample("clear", "17:40"));
    const summaries = frames.slice(1, 25).map((f) => f.summary);
    expect(summaries.some((s) => s.includes("la minima delle 24 ore"))).toBe(true);
    expect(summaries.some((s) => s.includes("la massima delle 24 ore"))).toBe(true);
    expect(summaries.some((s) => /: \d+° in meno\./.test(s))).toBe(true);
  });

  it("describe a day with its range and its warmest hour", async () => {
    const { days } = buildTimeline(await sample("clear", "08:30"));
    expect(days[1].summary).toMatch(/, da \d+° a \d+°\. Picco verso (le \d+|mezzogiorno)\./);
  });
});
