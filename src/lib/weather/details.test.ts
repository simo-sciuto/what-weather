import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEVEL_LABELS } from "@/constants/labels";
import { createMockProvider } from "@/lib/api/providers/mock";
import { uvInfo, windInfo } from "./details";

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const weather = async () => createMockProvider("clear", "12:00").getByCoords(45.46, 9.19);

describe("the words the details say", () => {
  it("calls the UV by the number people see, on the scale it shares with the pollen, and one step more at the top", async () => {
    const d = await weather();
    const category = (uv: number) => uvInfo({ ...d, hourly: [], current: { ...d.current, uvIndex: uv } })!.category;
    // The number shown is the rounded one, so 5.6 reads 6 and is "Alto", never "Moderato"
    expect([0, 2.4, 3, 5.4, 5.6, 6, 7.4, 8, 10.4, 11, 14].map(category)).toEqual([
      LEVEL_LABELS[0], LEVEL_LABELS[0], LEVEL_LABELS[1], LEVEL_LABELS[1], LEVEL_LABELS[2], LEVEL_LABELS[2],
      LEVEL_LABELS[2], LEVEL_LABELS[3], LEVEL_LABELS[3], "Estremo", "Estremo",
    ]);
    expect(LEVEL_LABELS).toEqual(["Basso", "Moderato", "Alto", "Molto alto"]);
  });

  it("describes the wind on the Beaufort scale, from calm up", async () => {
    const d = await weather();
    const description = (kmh: number) => windInfo({ ...d, current: { ...d.current, windSpeed: kmh, windGust: undefined } }).description;
    expect(description(0)).toBe("Calma");
    expect(description(5)).toBe("Bava di vento");
    expect(description(45)).toBe("Vento fresco");
    expect(description(200)).toBe("Tempesta violenta");
  });
});
