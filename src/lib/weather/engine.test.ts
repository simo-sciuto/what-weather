import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENGINE_ON, ENGINE_PARAM, engineFromParam, withEngine } from "./engine";
import { buildTimeline } from "./frames";
import { frameLook } from "./look";
import { createMockProvider, type MockScenario } from "./mock";
import { atmospherePalette, skyPalette } from "./palette";

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const frames = async (scenario: MockScenario, at: string) => {
  const data = await createMockProvider(scenario, at).getByCoords(45.46, 9.19);
  return buildTimeline(data).frames;
};

describe("the palette switch (WTH-046L)", () => {
  it("is on for exactly ?motore=atmosfera and off for anything else, a repeated or empty parameter included", () => {
    expect(ENGINE_PARAM).toBe("motore");
    expect(ENGINE_ON).toBe("atmosfera");
    expect(engineFromParam("atmosfera")).toBe("atmosphere");
    for (const other of [undefined, "", "live", "oggi", "Atmosfera", "atmosfera ", "1", ["atmosfera"], ["atmosfera", "atmosfera"]])
      expect(engineFromParam(other as string | string[] | undefined), String(other)).toBe("live");
  });

  it("leaves the live page's addresses exactly as they were, and adds the switch to the atmosphere's", () => {
    for (const href of ["/", "/?lat=45.4600&lon=9.1900&name=Milano", "/?lat=1&lon=2#top"]) expect(withEngine(href, "live")).toBe(href);
    expect(withEngine("/?lat=45.4600&lon=9.1900", "atmosphere")).toBe("/?lat=45.4600&lon=9.1900&motore=atmosfera");
    expect(withEngine("/", "atmosphere")).toBe("/?motore=atmosfera");
    expect(withEngine("/?lat=1&lon=2#top", "atmosphere")).toBe("/?lat=1&lon=2&motore=atmosfera#top");
    // A fragment is kept whole, an empty one too, even with a second `#` in it; a parameter already there is set, never doubled
    expect(withEngine("/?lat=1#a#b", "atmosphere")).toBe("/?lat=1&motore=atmosfera#a#b");
    expect(withEngine("/?lat=1#", "atmosphere")).toBe("/?lat=1&motore=atmosfera#");
    expect(withEngine("/?motore=live&lat=1", "atmosphere")).toBe("/?motore=atmosfera&lat=1");
    // The sample scenarios of the footer
    expect(withEngine("/?mock=heavy-rain&at=18:00", "atmosphere")).toBe("/?mock=heavy-rain&at=18%3A00&motore=atmosfera");
    // Never twice
    expect(withEngine(withEngine("/?lat=1", "atmosphere"), "atmosphere")).toBe("/?lat=1&motore=atmosfera");
    // The names with spaces and accents survive
    const href = withEngine("/?name=San%20Marino&region=Citt%C3%A0", "atmosphere");
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("name")).toBe("San Marino");
    expect(q.get("region")).toBe("Città");
    expect(q.get(ENGINE_PARAM)).toBe(ENGINE_ON);
  });

  it("changes nothing by default: the look is the page's own palette, as before the switch existed", async () => {
    for (const [scenario, at] of [["clear", "12:00"], ["heavy-rain", "18:00"], ["snow", "08:00"], ["fog", "07:00"], ["storm", "21:00"]] as const) {
      const [f] = await frames(scenario, at);
      expect(frameLook(f).palette).toEqual(skyPalette({ light: f.light, state: f.state, cloudCover: f.cloudCover, uv: f.uv }));
      expect(frameLook(f, "live")).toEqual(frameLook(f));
    }
  });

  it("paints from the atmosphere when asked: the same atmosphere, solar phase and palette the lab shows", async () => {
    for (const [scenario, at] of [["clear", "12:00"], ["heavy-rain", "18:00"], ["snow", "08:00"], ["fog", "07:00"]] as const) {
      const [f] = await frames(scenario, at);
      const look = frameLook(f, "atmosphere");
      expect(look.palette).toEqual(atmospherePalette(f.light, look.atmosphere));
      // Everything but the palette is the same under both engines: the sky's position, the atmosphere, what it rests on
      const live = frameLook(f);
      expect(look.sky).toEqual(live.sky);
      expect(look.atmosphere).toEqual(live.atmosphere);
      expect(look.atmosphereInputStatus).toEqual(live.atmosphereInputStatus);
    }
  });

  it("carries the weather's air into the palette only under the atmosphere: clear for the page's own", async () => {
    const [f] = await frames("heavy-rain", "18:00");
    const clear = { depth: 1, waterWeight: 1, roadWeight: 1, buildingWeight: 1, terrainWeight: 1, saturation: 1, landLift: 0, waterDeepen: 0 };
    expect(frameLook(f).palette.air).toEqual(clear);
    expect(frameLook(f, "atmosphere").palette.air).not.toEqual(clear);
  });

  it("makes a different sky in the rain, so the switch shows something", async () => {
    const [f] = await frames("heavy-rain", "13:00");
    const [a, b] = [frameLook(f).palette, frameLook(f, "atmosphere").palette];
    expect([a.sky1, a.sky2, a.sky3].join()).not.toBe([b.sky1, b.sky2, b.sky3].join());
  });

  it("works for every frame of a day, the overview of a day with no hourly readings included", async () => {
    const data = await createMockProvider("heavy-rain", "12:00").getByCoords(45.46, 9.19);
    const timeline = buildTimeline(data);
    for (const f of [...timeline.frames, ...timeline.days.map((d) => d.overview)]) {
      const p = frameLook(f, "atmosphere").palette;
      for (const hex of [p.sky1, p.sky2, p.sky3]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(Object.keys(p.map).length).toBeGreaterThan(5);
    }
  });
});
