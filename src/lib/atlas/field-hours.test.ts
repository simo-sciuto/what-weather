import { describe, expect, it } from "vitest";
import type { WeatherField } from "@/types/atlas";
import { fieldColorsAt } from "./field-hours";

const H = 3600;
const FIELD: WeatherField = {
  step: 1,
  lats: [44, 45],
  lons: [7, 8],
  provider: "mock",
  time: 1000 * H,
  colors: ["#000001", "#000002", "#000003", "#000004"],
  temps: [1, 2, 3, 4],
  hours: [1000, 1001, 1002].map((h) => ({ time: h * H, colors: [`#0${h}`.padEnd(7, "a").slice(0, 7), "#bbbbbb", "#cccccc", "#dddddd"] })),
};

describe("fieldColorsAt", () => {
  it("Adesso is now's colours", () => {
    expect(fieldColorsAt(FIELD, null)).toEqual({ colors: FIELD.colors, time: FIELD.time, nowOnly: false });
  });

  it("an instant is its own hour's colours, within half an hour", () => {
    expect(fieldColorsAt(FIELD, 1002 * H + 900)).toEqual({ colors: FIELD.hours![2].colors, time: 1002 * H, nowOnly: false });
  });

  it("an hour the field does not reach shows now's colours, marked as now's", () => {
    expect(fieldColorsAt(FIELD, 1100 * H)).toEqual({ colors: FIELD.colors, time: FIELD.time, nowOnly: true });
    expect(fieldColorsAt({ ...FIELD, hours: undefined }, 1001 * H).nowOnly).toBe(true);
  });

  it("an hour whose colours do not fit the lattice is not drawn", () => {
    expect(fieldColorsAt({ ...FIELD, hours: [{ time: 1001 * H, colors: ["#ffffff"] }] }, 1001 * H).nowOnly).toBe(true);
  });
});
