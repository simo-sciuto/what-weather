import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { activityOutlook, dailyActivityOutlooks } from "./activities";
import { localDay } from "./formatters";
import { DEFAULT_PLACE } from "./constants";
import { MOCK_SCENARIOS, createMockProvider, type MockScenario } from "@/lib/api/providers/mock";

/**
 * The activities' verdicts: each one judged by its own profile, with its best
 * hours and the reason when something holds it back.
 */

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

/** "Corsa" → "Buone · adesso, fino alle 9 · fa caldo" */
async function outlook(scenario: MockScenario, at: string): Promise<Record<string, string>> {
  const d = await createMockProvider(scenario, at).getByCoords(DEFAULT_PLACE.lat, DEFAULT_PLACE.lon);
  return Object.fromEntries(
    activityOutlook(d).map((a) => [a.name, [a.verdict, a.window, a.reason].filter(Boolean).join(" · ")]),
  );
}

describe("the activities", () => {
  it("judge a warm clear morning each in its own way", async () => {
    const o = await outlook("clear", "08:30");
    expect(o["Passeggiata"]).toBe("Ottime · adesso, fino alle 11");
    // A run wants it cooler, and soon gets too warm
    expect(o["Corsa"]).toBe("Ottime · adesso, fino alle 9");
  });

  it("have no best hours in a day of rain, and say it is the rain", async () => {
    for (const at of ["08:30", "22:30"]) {
      const o = await outlook("heavy-rain", at);
      expect(Object.values(o)).toEqual(Array(4).fill("Scarse · pioggia"));
    }
  });

  it("let the wind stop a bike before a walk", async () => {
    const o = await outlook("windy", "08:30");
    expect(o["Passeggiata"]).toMatch(/^Buone · .* · vento$/);
    expect(o["Bici"]).toBe("Scarse · vento");
  });

  it("let poor air cost a run more than a walk", async () => {
    const o = await outlook("smog", "13:00");
    expect(o["Passeggiata"]).toMatch(/^Buone · .* · aria inquinata$/);
    expect(o["Corsa"]).toMatch(/^Discrete · .* · aria inquinata$/);
  });

  it("are judged day by day too, for the days the hours cover whole", async () => {
    const d = await createMockProvider("smog", "08:30").getByCoords(DEFAULT_PLACE.lat, DEFAULT_PLACE.lon);
    const days = dailyActivityOutlooks(d);
    // The sample forecast runs 48 hours: today is the next 24 hours' to tell, the day after is cut short
    const tomorrow = localDay(d.current.time + 86400, d.timezone);
    expect(Object.keys(days)).toEqual([tomorrow]);

    const walk = days[tomorrow].find((a) => a.name === "Passeggiata")!;
    // A day's own hours: no "adesso", no "domani"
    expect(walk.window).toMatch(/^dalle \d+ alle \d+$/);
    // Today's air says nothing of tomorrow's
    expect(days[tomorrow].map((a) => a.reason)).not.toContain("aria inquinata");
    expect(activityOutlook(d).map((a) => a.reason)).toContain("aria inquinata");
  });

  it("keep the full matrix stable", async () => {
    const matrix: Record<string, Record<string, string>> = {};
    for (const scenario of MOCK_SCENARIOS) {
      for (const at of ["05:30", "08:30", "13:00", "17:40", "22:30"]) matrix[`${scenario} ${at}`] = await outlook(scenario, at);
    }
    expect(matrix).toMatchSnapshot();
  });
});
