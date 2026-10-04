import type { AtmosphereComputation } from "./visual-input";

/**
 * The Weather Fingerprint (WTH-046J): the internal visual DNA of a record, `PLACE + TIME + WEATHER` reduced to
 * the eight numbers the engine paints from. Pure and deterministic, no UI in V1: it is the handle for what comes
 * after (metadata on a poster, comparing two records, an archive, a collection, a graphic of the DNA, similarity),
 * none of which is built here.
 *
 * What it holds, and nothing else:
 * - `phase`, the solar phase coordinate of `Frame.light` (-1 night before dawn, 0 sunrise, 1 sunset, 2 night after
 *   dusk). This is the plan's "light", named for what it is: it is NOT the normalized daylight axis (0..1, a
 *   function of the phase: 2 sin(pi phase) between sunrise and sunset, 0 outside) and NOT the sky's lightness.
 *   Dawn and dusk (phase 0.3 and 0.7) have the same daylight and are two different records, so the phase, not the
 *   daylight, is what is kept; daylight is derived from it when needed.
 * - the atmosphere's axes as `computeAtmosphere` normalizes them: `warmth` (-1 cold to 1 hot), `cloud`, `haze`, `wet`,
 *   `snow`, `severity` and `energy` (the solar energy, never above the daylight) in 0..1.
 * - `basis`, which of the measurements the axes were worked out from (see `BASIS`): the same DNA from a full set of
 *   readings and from half of them is the same picture and a different certainty, and the second must not pass
 *   for the first. It is not part of the DNA (`dnaKey`).
 *
 * What it leaves out on purpose: the place (its name, its coordinates), the clock, units, the provider, the
 * wind (parked, WTH-046M) and any palette: the same inputs give the same fingerprint wherever and whenever, and
 * a palette can change with the engine while the DNA of a record does not.
 *
 * Precision: every field is a whole number of hundredths (`STEPS` per unit), `phase` from -100 to 200, `warmth`
 * from -100 to 100, the rest from 0 to 100. A hundredth is finer than any eye tells in the palette and coarser
 * than the floating-point noise of the curves, so equal inputs give equal fingerprints. Rounding is half up on
 * the value taken to a billionth first, so a value that lands exactly between two steps always goes the same way.
 */

/** Steps per unit: a hundredth */
export const STEPS = 100;
/** Bumped when a field, the precision or the meaning of a field changes: an archived key says which it is */
export const FINGERPRINT_VERSION = 1;

/** The measurements the axes may rest on, in the order of the key's letters: temperature, cloud, humidity, visibility, dew point, precipitation, UV */
export const BASIS = ["temp", "cloudCover", "humidity", "visibility", "dewPoint", "precipitation", "uvIndex"] as const;
const BASIS_LETTERS = "tchvdpu";

export interface WeatherFingerprint {
  readonly version: typeof FINGERPRINT_VERSION;
  /** Solar phase, in hundredths: -100..200 (see above: not the daylight) */
  readonly phase: number;
  /** -100 (cold) to 100 (hot) */
  readonly warmth: number;
  readonly cloud: number;
  readonly haze: number;
  readonly wet: number;
  readonly snow: number;
  readonly severity: number;
  readonly energy: number;
  /** The letters of the measurements the axes rest on, in the order of `BASIS` (none: ""): provenance, not DNA */
  readonly basis: string;
}

const step = (x: number) => Math.floor(x * STEPS + 0.5 + 1e-9);
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The fingerprint of a moment: its atmosphere (and which measurements it rests on, from `computeAtmosphere`) and
 * its solar phase (`Frame.light`). A phase that is not a finite number is refused rather than turned into a
 * night: an invented coordinate would be a different record under the same key.
 */
export function fingerprintOf(
  { atmosphere: a, inputStatus }: Pick<AtmosphereComputation, "atmosphere" | "inputStatus">,
  phase: number,
): WeatherFingerprint {
  if (!Number.isFinite(phase)) throw new RangeError("Fingerprint phase must be a finite number");
  for (const [axis, value] of Object.entries({ ...a, phase })) {
    if (typeof value === "number" && !Number.isFinite(value)) throw new RangeError(`Fingerprint ${axis} must be a finite number`);
  }
  const basis = BASIS.map((key, i) => (inputStatus[key] === "supplied" || inputStatus[key] === "clamped" ? BASIS_LETTERS[i] : "")).join("");
  return Object.freeze({
    version: FINGERPRINT_VERSION,
    phase: clampInt(step(phase), -STEPS, 2 * STEPS),
    warmth: clampInt(step(a.warmth), -STEPS, STEPS),
    cloud: clampInt(step(a.cloudiness), 0, STEPS),
    haze: clampInt(step(a.haze), 0, STEPS),
    wet: clampInt(step(a.wetness), 0, STEPS),
    snow: clampInt(step(a.snow), 0, STEPS),
    severity: clampInt(step(a.severity), 0, STEPS),
    energy: clampInt(step(a.energy), 0, STEPS),
    basis,
  });
}

const FIELDS = ["phase", "warmth", "cloud", "haze", "wet", "snow", "severity", "energy"] as const;
const LETTER = { phase: "p", warmth: "w", cloud: "c", haze: "h", wet: "r", snow: "s", severity: "v", energy: "e" } as const;

/** The DNA alone, as a stable string: what two records must share to be the same picture, whatever they rest on. `wf1/p45/w-12/...` */
export function dnaKey(fp: WeatherFingerprint): string {
  return `wf${fp.version}/${FIELDS.map((f) => `${LETTER[f]}${fp[f]}`).join("/")}`;
}

/** The whole fingerprint as a stable string: the DNA, then `~` and the basis. `wf1/p45/w-12/...~tcvp` */
export function fingerprintKey(fp: WeatherFingerprint): string {
  return `${dnaKey(fp)}~${fp.basis}`;
}

const RANGE: Record<(typeof FIELDS)[number], [number, number]> = {
  phase: [-STEPS, 2 * STEPS],
  warmth: [-STEPS, STEPS],
  cloud: [0, STEPS],
  haze: [0, STEPS],
  wet: [0, STEPS],
  snow: [0, STEPS],
  severity: [0, STEPS],
  energy: [0, STEPS],
};

/** A whole number as `String` writes it: no leading zero, no `+`, no `-0` */
const UINT = "(0|[1-9]\\d*)";
const INT = "(0|-?[1-9]\\d*)";
const KEY = new RegExp(`^wf${UINT}/p${INT}/w${INT}/c${UINT}/h${UINT}/r${UINT}/s${UINT}/v${UINT}/e${UINT}~([a-z]*)$`);

/**
 * The fingerprint a key stands for; null for anything that is not one: another version, a field out of range, a
 * basis out of order, or a number not written as the key writes it (`p045`, `w-0`, `wf01`). One fingerprint has one
 * key, so a key can be an id or an index.
 */
export function parseFingerprint(key: string): WeatherFingerprint | null {
  const m = KEY.exec(key);
  if (!m || Number(m[1]) !== FINGERPRINT_VERSION) return null;
  const values = m.slice(2, 10).map(Number);
  if (!FIELDS.every((f, i) => values[i] >= RANGE[f][0] && values[i] <= RANGE[f][1])) return null;
  const basis = m[10];
  // Letters of BASIS_LETTERS only, each once, in the order of the key's alphabet
  if (!/^[a-z]*$/.test(basis) || [...basis].some((c) => !BASIS_LETTERS.includes(c))) return null;
  const order = [...basis].map((c) => BASIS_LETTERS.indexOf(c));
  if (order.some((n, i) => i > 0 && n <= order[i - 1])) return null;
  const [phase, warmth, cloud, haze, wet, snow, severity, energy] = values;
  const fp: WeatherFingerprint = Object.freeze({ version: FINGERPRINT_VERSION, phase, warmth, cloud, haze, wet, snow, severity, energy, basis });
  // The last word: only a key the fingerprint would write itself
  return fingerprintKey(fp) === key ? fp : null;
}
