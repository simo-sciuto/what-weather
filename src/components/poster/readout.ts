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
   * The axis's value rests, at least in part, on a stand-in instead of the provider's figure (the condition's
   * typical value, a neutral reference, a missing term taken as zero): its track is dashed whatever the value,
   * so a stand-in zero is never mistaken for a figure. Not the same as interpolated: see `Frame.measured`.
   */
  estimated: boolean;
}

/** The normalized daylight (0..1) of a solar phase in hundredths, as the engine derives it (`computeAtmosphere`) */
export function daylightOf(phase: number): number {
  const p = phase / STEPS;
  return p <= 0 || p >= 1 ? 0 : Math.min(1, 2 * Math.sin(Math.PI * p));
}

/**
 * `allDay`: the moment is a day's stand-in frame (`Frame.overview`), not an hour: its phase is a nominal instant,
 * so its light is not a reading of that day either.
 */
export function readoutRows(fp: WeatherFingerprint, { allDay = false }: { allDay?: boolean } = {}): ReadoutRow[] {
  // The basis letters: temperature, cloud, humidity, visibility, dew point, precipitation, UV (fingerprint.ts)
  const has = (letter: string) => fp.basis.includes(letter);
  // Without a rate, the condition and its intensity stand in, but only for a condition that falls: a dry
  // condition's zero is the condition's, not a stand-in (computeAtmosphere)
  const fallStandIn = (hundredths: number) => !has("p") && hundredths > 0;
  const daylight = daylightOf(fp.phase);
  const row = (label: string, hundredths: number, estimated: boolean, centred = false): ReadoutRow => ({
    label,
    value: hundredths / STEPS,
    centred,
    estimated,
  });
  return [
    // The sun's phase is worked out for the hour, never measured; a whole day has no hour
    { label: "Light", value: daylight, centred: false, estimated: allDay },
    row("Warmth", fp.warmth, !has("t"), true),
    // Without a cover, the condition's typical one
    row("Cloud", fp.cloud, !has("c")),
    // Haze is visibility (without it only the fog condition stands in), the dew point's distance from the
    // temperature and the humidity (each zero when missing), less what a fall takes from the view
    row("Haze", fp.haze, !has("v") || !has("h") || !has("t") || !has("d") || fallStandIn(fp.wet + fp.snow)),
    row("Wet", fp.wet, fallStandIn(fp.wet)),
    row("Snow", fp.snow, fallStandIn(fp.snow)),
    row("Storm", fp.severity, fallStandIn(fp.severity)),
    // At night there is no solar energy whatever the UV; by day, without UV, a neutral reference
    row("Energy", fp.energy, fp.energy > 0 && !has("u")),
  ];
}

/**
 * "03.10.2026 · 18:42 CEST": the moment of the record at the place, in its own time zone and with the zone's
 * name, so a record read anywhere says which clock it is on. Numbers only, read the same in any language.
 * A whole day (`allDay`) is its date alone: its frame's time is a nominal instant, not the moment shown.
 */
export function readoutStamp(ts: number, timeZone: string, { allDay = false }: { allDay?: boolean } = {}): string {
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
  if (allDay) return `${get("day")}.${get("month")}.${get("year")}`;
  return [`${get("day")}.${get("month")}.${get("year")}`, `${formatTime(ts, timeZone)}${zone ? ` ${zone}` : ""}`].join(" · ");
}
