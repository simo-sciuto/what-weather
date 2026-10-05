import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline } from "./frames";
import { frameLook } from "./look";
import { createMockProvider, type MockScenario } from "@/lib/api/providers/mock";
import { atmospherePalette, CLEAR_MAP, skyPalette } from "./palette";

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const timelineOf = async (scenario: MockScenario, at: string) =>
  buildTimeline(await createMockProvider(scenario, at).getByCoords(45.46, 9.19));

describe("how a frame looks (WTH-046L)", () => {
  it("is painted from the atmosphere: the palette is the atmosphere's, at the frame's solar phase", async () => {
    for (const [scenario, at] of [["clear", "12:00"], ["heavy-rain", "18:00"], ["snow", "08:00"], ["fog", "07:00"], ["storm", "21:00"]] as const) {
      const [f] = (await timelineOf(scenario, at)).frames;
      const look = frameLook(f);
      expect(look.palette, `${scenario} at ${at}`).toEqual(atmospherePalette(f.light, look.atmosphere));
    }
  });

  it("carries the weather's air into the palette: the map is drawn in it, for the page, the viewer's tuning and the poster", async () => {
    const rain = frameLook((await timelineOf("heavy-rain", "18:00")).frames[0]).palette;
    expect(rain.air).not.toEqual(CLEAR_MAP);
    // A plain night has no weather to say
    const night = (await timelineOf("clear", "23:30")).frames[0];
    expect(frameLook(night).palette.air.waterWeight).toBe(1);
  });

  it("is not the old palette: the rain's sky differs from the categorical one the page had", async () => {
    const [f] = (await timelineOf("heavy-rain", "13:00")).frames;
    const [now, before] = [frameLook(f).palette, skyPalette({ light: f.light, state: f.state, cloudCover: f.cloudCover, uv: f.uv })];
    expect([now.sky1, now.sky2, now.sky3].join()).not.toBe([before.sky1, before.sky2, before.sky3].join());
  });

  it("works for every frame of a day, the overview of each day (no hourly readings) included", async () => {
    const timeline = await timelineOf("heavy-rain", "12:00");
    for (const f of [...timeline.frames, ...timeline.days.map((d) => d.overview)]) {
      const look = frameLook(f);
      for (const hex of [look.palette.sky1, look.palette.sky2, look.palette.sky3]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(look.palette.glow).toMatch(/^rgb\(\d+ \d+ \d+ \/ [\d.]+\)$/);
      expect(Object.keys(look.palette.map).length).toBeGreaterThan(5);
    }
  });

  it("is deterministic: the same frame gives the same look, so server and browser agree", async () => {
    for (const f of (await timelineOf("snow", "09:00")).frames.slice(0, 8)) expect(frameLook(f)).toEqual(frameLook({ ...f }));
  });
});
