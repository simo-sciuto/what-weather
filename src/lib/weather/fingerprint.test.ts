import { describe, expect, it } from "vitest";
import { CALIBRATION_SCENARIOS } from "./calibration";
import { BASIS, dnaKey, FINGERPRINT_VERSION, fingerprintKey, fingerprintOf, parseFingerprint, STEPS } from "./fingerprint";
import { computeAtmosphere, type WeatherVisualInput } from "./visual-input";

const of = (input: WeatherVisualInput & { light: number }) => fingerprintOf(computeAtmosphere(input), input.light);
const scenario = (id: string) => CALIBRATION_SCENARIOS.find((s) => s.id === id)!;
/** The normalized daylight axis for a solar phase, written out here (WTH-046B) */
const daylightAt = (phase: number) => (phase <= 0 || phase >= 1 ? 0 : Math.min(1, 2 * Math.sin(Math.PI * phase)));

describe("the weather fingerprint (WTH-046J)", () => {
  it("is the same for the same inputs, every time, and frozen", () => {
    for (const s of CALIBRATION_SCENARIOS) {
      const [a, b] = [of(s.input), of({ ...s.input })];
      expect(a).toEqual(b);
      expect(fingerprintKey(a)).toBe(fingerprintKey(b));
      expect(Object.isFrozen(a)).toBe(true);
    }
  });

  it("holds whole hundredths inside their ranges, and an energy that never exceeds the daylight of its phase", () => {
    for (const s of CALIBRATION_SCENARIOS)
      for (const phase of [-1, -0.5, 0, 0.02, 0.17, 0.5, 0.9, 1, 1.4, 2]) {
        const fp = of({ ...s.input, light: phase });
        for (const f of ["phase", "warmth", "cloud", "haze", "wet", "snow", "severity", "energy"] as const) expect(Number.isInteger(fp[f]), `${s.id} ${f}`).toBe(true);
        expect(fp.phase).toBe(Math.round(phase * STEPS));
        expect(Math.abs(fp.warmth)).toBeLessThanOrEqual(STEPS);
        for (const f of ["cloud", "haze", "wet", "snow", "severity", "energy"] as const) {
          expect(fp[f]).toBeGreaterThanOrEqual(0);
          expect(fp[f]).toBeLessThanOrEqual(STEPS);
        }
        expect(fp.energy, `${s.id} at ${phase}`).toBeLessThanOrEqual(Math.round(daylightAt(phase) * STEPS) + 1);
      }
  });

  it("tells every calibration scenario apart, and keeps the families near: light and maritime rain differ in fewer fields than rain and snow", () => {
    const keys = CALIBRATION_SCENARIOS.map((s) => dnaKey(of(s.input)));
    expect(new Set(keys).size).toBe(keys.length);
    const differing = (a: string, b: string) => {
      const [x, y] = [of(scenario(a).input), of(scenario(b).input)];
      return (["warmth", "cloud", "haze", "wet", "snow", "severity", "energy"] as const).filter((f) => Math.abs(x[f] - y[f]) > 15).length;
    };
    expect(differing("light-rain", "maritime-rain")).toBeLessThan(differing("light-rain", "snow"));
    expect(differing("snow", "northern-snow")).toBeLessThan(differing("snow", "heavy-rain"));
  });

  it("changes by at most one step in one field when an input moves a little: no jumps, no flicker", { timeout: 30_000 }, () => {
    for (const sc of CALIBRATION_SCENARIOS)
      for (const key of ["temp", "cloudCover", "humidity", "visibility", "dewPoint", "precipitation", "uvIndex"] as const)
        for (const bump of [0.0001, 0.001, -0.001]) {
          const value = sc.input[key] as number;
          // Precipitation and visibility have no negative: nudge them the other way at zero
          const moved = value + bump < 0 ? value - bump : value + bump;
          const base = of(sc.input);
          const nudged = of({ ...sc.input, [key]: moved });
          for (const f of ["warmth", "cloud", "haze", "wet", "snow", "severity", "energy"] as const)
            expect(Math.abs(base[f] - nudged[f]), `${sc.id} ${key} ${bump} on ${f}`).toBeLessThanOrEqual(1);
        }
  });

  it("is a round trip: every key parses back to its fingerprint, and the basis is kept apart from the DNA", () => {
    for (const s of CALIBRATION_SCENARIOS)
      for (const phase of [-1, 0.3, 0.7, 2]) {
        const fp = of({ ...s.input, light: phase });
        expect(parseFingerprint(fingerprintKey(fp))).toEqual(fp);
        expect(fingerprintKey(fp).startsWith(dnaKey(fp))).toBe(true);
      }
  });

  it("refuses what is not a fingerprint: another version, a field out of range, a basis out of order or foreign, a phase that is no number", () => {
    const good = fingerprintKey(of(scenario("heavy-rain").input));
    expect(parseFingerprint(good)).not.toBeNull();
    for (const bad of [
      good.replace(/^wf1/, "wf2"),
      good.replace(/\/c\d+/, "/c101"),
      good.replace(/\/p-?\d+/, "/p201"),
      good.replace(/\/w-?\d+/, "/w-101"),
      good.replace(/\/p-?\d+/, "/p1.5"),
      good.replace(/~.*$/, "~ct"),
      good.replace(/~.*$/, "~tt"),
      good.replace(/~.*$/, "~z"),
      good.replace(/~.*$/, ""),
      "",
      "wf1/p10",
      // Not written as the key writes them: one fingerprint, one key
      good.replace(/^wf1/, "wf01"),
      good.replace(/\/p(-?)(\d+)/, "/p$10$2"),
      good.replace(/\/c(\d+)/, "/c0$1"),
      good.replace(/\/w-?\d+/, "/w-0"),
      good.replace(/\/p-?\d+/, "/p+45"),
      `${good} `,
    ])
      expect(parseFingerprint(bad), bad).toBeNull();
    for (const phase of [NaN, Infinity]) expect(() => fingerprintOf(computeAtmosphere(scenario("snow").input), phase)).toThrow(RangeError);
    // An axis that is no number is refused too, not frozen into a key that cannot be read back
    const computation = computeAtmosphere(scenario("snow").input);
    expect(() => fingerprintOf({ ...computation, atmosphere: { ...computation.atmosphere, haze: NaN } }, 0.4)).toThrow(RangeError);
  });

  it("accepts the empty basis, written with its tilde, and reads it back", () => {
    const { visibility: _v, dewPoint: _d, humidity: _h, temp: _t, cloudCover: _c, precipitation: _p, uvIndex: _u, ...nothing } = scenario("snow").input;
    void [_v, _d, _h, _t, _c, _p, _u];
    const fp = of({ ...nothing, light: 0.4 });
    expect(fp.basis).toBe("");
    expect(fingerprintKey(fp).endsWith("~")).toBe(true);
    expect(parseFingerprint(fingerprintKey(fp))).toEqual(fp);
  });

  it("keeps the phase and the daylight apart: dawn and dusk share a daylight and are two records; a night before dawn and one after dusk too", () => {
    const base = scenario("dry-heat").input;
    const [dawn, dusk] = [of({ ...base, light: 0.3 }), of({ ...base, light: 0.7 })];
    expect(daylightAt(0.3)).toBeCloseTo(daylightAt(0.7));
    expect(dawn.phase).not.toBe(dusk.phase);
    expect(dnaKey(dawn)).not.toBe(dnaKey(dusk));
    // Their weather is the same, so the whole difference is the phase
    for (const f of ["warmth", "cloud", "haze", "wet", "snow", "severity", "energy"] as const) expect(dawn[f]).toBe(dusk[f]);
    const [before, after] = [of({ ...base, light: -1 }), of({ ...base, light: 2 })];
    expect(before.energy).toBe(0);
    expect(after.energy).toBe(0);
    expect(dnaKey(before)).not.toBe(dnaKey(after));
  });

  it("says what a fingerprint rests on, not only what it shows: the same DNA from fewer measurements is another key", () => {
    const full = scenario("mediterranean-sun").input;
    const { visibility: _v, dewPoint: _d, ...fewer } = full;
    void _v;
    void _d;
    const [a, b] = [of(full), of(fewer)];
    expect(a.basis.length).toBeGreaterThan(b.basis.length);
    expect(b.basis).not.toContain("v");
    expect(b.basis).not.toContain("d");
    // A clear dry noon is as clear without them: the picture is the same, the certainty is not
    expect(dnaKey(a)).toBe(dnaKey(b));
    expect(fingerprintKey(a)).not.toBe(fingerprintKey(b));
    expect(BASIS.length).toBe(7);
  });

  it("holds no place, no clock, no unit and no palette: only its own fields and the version", () => {
    const fp = of(scenario("humid-fog-plain").input);
    expect(Object.keys(fp).sort()).toEqual(["basis", "cloud", "energy", "haze", "phase", "severity", "snow", "version", "warmth", "wet"]);
    expect(fp.version).toBe(FINGERPRINT_VERSION);
    expect(fingerprintKey(fp)).toMatch(/^wf1(\/[a-z]-?\d+){8}~[a-z]*$/);
  });
});
