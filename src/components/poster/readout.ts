import { STEPS, type WeatherFingerprint } from "@/lib/weather/fingerprint";
import { dateFormat, formatTime } from "@/lib/weather/formatters";

/**
 * The poster's readout (WTH-183): the record's Weather Fingerprint as a column of bars, the same rows in the
 * same order on every poster so two records compare at a glance. No figures: the bars are the reading.
 */
export interface ReadoutRow {
  label: string;
  /** 0..1, or -1..1 when `centred` */
  value: number;
  /** Drawn from the middle of its track: warmth, cold to the left, hot to the right */
  centred: boolean;
  /**
   * The axis had no measurement of its own and rests on a stand-in (the condition's typical value, a neutral
   * reference): drawn in outline, not solid, so the poster never claims a reading it does not have.
   */
  estimated: boolean;
}

/** The normalized daylight (0..1) of a solar phase in hundredths, as the engine derives it (`computeAtmosphere`) */
export function daylightOf(phase: number): number {
  const p = phase / STEPS;
  return p <= 0 || p >= 1 ? 0 : Math.min(1, 2 * Math.sin(Math.PI * p));
}

export function readoutRows(fp: WeatherFingerprint): ReadoutRow[] {
  // The basis letters: temperature, cloud, humidity, visibility, dew point, precipitation, UV (fingerprint.ts)
  const has = (letter: string) => fp.basis.includes(letter);
  const daylight = daylightOf(fp.phase);
  const row = (label: string, hundredths: number, estimated: boolean, centred = false): ReadoutRow => ({
    label,
    value: hundredths / STEPS,
    centred,
    estimated,
  });
  return [
    // The sun's phase is worked out, never measured
    { label: "Light", value: daylight, centred: false, estimated: false },
    row("Warmth", fp.warmth, !has("t"), true),
    // Without a cover, the condition's typical one
    row("Cloud", fp.cloud, !has("c")),
    // Visibility leads haze; without it only the fog condition stands in
    row("Haze", fp.haze, !has("v")),
    // Without a rate, the condition and its intensity stand in for rain, snow and storm alike
    row("Wet", fp.wet, !has("p")),
    row("Snow", fp.snow, !has("p")),
    row("Storm", fp.severity, !has("p")),
    // At night there is no solar energy whatever the UV; by day, without UV, a neutral reference
    row("Energy", fp.energy, daylight > 0 && !has("u")),
  ];
}

/**
 * "03.10.2026 · 18:42 CEST": the moment of the record at the place, in its own time zone and with the zone's
 * name, so a record read anywhere says which clock it is on. Numbers only, read the same in any language.
 */
export function readoutStamp(ts: number, timeZone: string): string {
  const at = new Date(ts * 1000);
  const parts = dateFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZoneName: "short",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const zone = get("timeZoneName");
  return [`${get("day")}.${get("month")}.${get("year")}`, `${formatTime(ts, timeZone)}${zone ? ` ${zone}` : ""}`].join(" · ");
}
