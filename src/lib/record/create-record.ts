import { CONDITION_NAMES } from "@/constants/labels";
import { BASE_ZOOM } from "@/constants/map";
import type { HistoricalProvider, WeatherProvider } from "@/lib/api/providers/provider";
import type { Intensity, Reconstruction } from "@/types/weather";
import { localDay } from "@/lib/weather/formatters";
import type { RecordInput } from "./types";

/**
 * The record Create makes (WTH-233, docs/CREATE_SPEC.md): one composition, described whole, so its preview and its
 * export are drawn from the same thing. Two halves: what was recorded (the moment, its weather as a frozen snapshot
 * and where that weather came from), never edited by the user; and how it is drawn (the user's few choices).
 * Serializable as JSON and versioned: a reader refuses a version it does not know rather than guess.
 */

export const CREATE_RECORD_VERSION = 1;

/**
 * Where the record's figures come from (rule 7). `current`: the provider's current conditions, the live moment.
 * `forecast`: a model's value for any other hour of the live timeline, earlier hours of today included.
 * `reconstruction`: the past from the historical provider (ADR-016). There is no `observed`: no provider in use
 * gives a station reading for the place, and the record must not claim one.
 */
export type SourceKind = "current" | "forecast" | "reconstruction";

export type RecordSource =
  | { provider: WeatherProvider["name"]; kind: "current" | "forecast" }
  | {
      provider: HistoricalProvider["name"];
      kind: "reconstruction";
      /** Reanalysis (ERA5) or the operational model's archive (IFS from 2017) */
      method: Reconstruction["kind"];
      model: string;
      confidence: Reconstruction["confidence"];
    };

/** The three treatments of the composition engine (the user, 2026-10-13); Editorial is the default */
export type Treatment = "editorial" | "monochrome" | "chromatic";

/** The format's id: its shape, not a print claim (WTH-239) */
export type CreateFormat = "a4" | "story" | "square";

/**
 * The map's view. Fixed to the base view in v1 (ADR-018): not a choice of `createRecordOf`, and a v1 record with
 * another view is refused. It is stored so that letting it change is a new version, not a silent one.
 */
export type RecordView = { zoom: number; pitch: number; bearing: number };

/** The base view: the whole city, flat, north up; centred on the place by the map's drawing */
export const BASE_VIEW: Readonly<RecordView> = Object.freeze({ zoom: BASE_ZOOM, pitch: 0, bearing: 0 });

/**
 * The view Create's poster is drawn from: always the base view, whatever the weather page's map was left at, so the
 * same place and moment give the same poster however `/crea` was reached (ADR-018).
 */
export function createView(): RecordView {
  return { ...BASE_VIEW };
}

export type CreateDesign = {
  treatment: Treatment;
  format: CreateFormat;
  /** What the composition shows beyond the place */
  show: { temperature: boolean; coordinates: boolean };
  view: RecordView;
};

export type CreateRecord = {
  v: typeof CREATE_RECORD_VERSION;
  /** The moment, Unix seconds */
  at: number;
  /** The place's zone, IANA ("Europe/Rome") or a fixed offset ("+02:00") */
  timeZone: string;
  /** The moment's facts as the record engine reads them, frozen when the record is made: absent stays absent */
  weather: RecordInput;
  source: RecordSource;
  /** When the weather was read, Unix seconds */
  fetchedAt: number;
  design: CreateDesign;
};

export const DEFAULT_DESIGN: Readonly<CreateDesign> = Object.freeze({
  treatment: "editorial",
  format: "a4",
  show: Object.freeze({ temperature: true, coordinates: true }),
  view: BASE_VIEW,
});

/** What the user may choose in v1: everything in the design but the view */
export type DesignChoices = Partial<Omit<CreateDesign, "view">>;

/** The oldest moment the historical provider reaches, and the first of the IFS archive (ADR-016) */
const ARCHIVE_FROM = Date.UTC(1940, 0, 1) / 1000;
const IFS_ARCHIVE_FROM = Date.UTC(2017, 0, 1) / 1000;
/** How far the live moment may lie from the reading: the provider's current conditions are up to an hour or so old */
const CURRENT_TOLERANCE = 3 * 3600;

/** What the record is made from: the poster's snapshot has this shape (`PosterSnapshot`) */
export type RecordMoment = { record: RecordInput; time: number; timeZone: string };

/**
 * The source of a moment's figures. `live` is the moment the page calls now (the timeline's first frame, no day
 * picked); a reconstruction overrides it, since the past is never current.
 */
export function sourceOf({
  provider,
  live,
  reconstruction,
}: {
  provider: WeatherProvider["name"] | HistoricalProvider["name"];
  live: boolean;
  reconstruction?: Reconstruction;
}): RecordSource {
  if (provider === "open-meteo-archive") {
    if (!reconstruction) throw new Error("A historical record needs its reconstruction");
    return { provider, kind: "reconstruction", method: reconstruction.kind, model: reconstruction.model, confidence: reconstruction.confidence };
  }
  if (reconstruction) throw new Error("A reconstruction comes from the historical provider");
  return { provider, kind: live ? "current" : "forecast" };
}

/** A record of the moment, with the default design unless choices are given. Pure. */
export function createRecordOf(
  moment: RecordMoment,
  source: RecordSource,
  fetchedAt: number,
  design: DesignChoices = {},
): CreateRecord {
  // A choice left undefined keeps its default
  const chosen = Object.fromEntries(Object.entries(design).filter(([, v]) => v !== undefined)) as DesignChoices;
  return {
    v: CREATE_RECORD_VERSION,
    at: moment.time,
    timeZone: moment.timeZone,
    weather: moment.record,
    source,
    fetchedAt,
    design: {
      treatment: chosen.treatment ?? DEFAULT_DESIGN.treatment,
      format: chosen.format ?? DEFAULT_DESIGN.format,
      show: { ...DEFAULT_DESIGN.show, ...chosen.show },
      view: { ...BASE_VIEW },
    },
  };
}

export function serializeCreateRecord(record: CreateRecord): string {
  return JSON.stringify(record);
}

export type ParsedRecord = { ok: true; record: CreateRecord } | { ok: false; reason: string };

/** Reads a serialized record, checking every field. Never throws: a bad record comes back with the reason. */
export function parseCreateRecord(text: string): ParsedRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not JSON" };
  }
  try {
    return { ok: true, record: checkRecord(raw) };
  } catch (e) {
    return { ok: false, reason: e instanceof Invalid ? e.message : "invalid" };
  }
}

class Invalid extends Error {}

const fail = (path: string, what: string): never => {
  throw new Invalid(`${path}: ${what}`);
};

type Obj = Record<string, unknown>;

function obj(v: unknown, path: string): Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : fail(path, "not an object");
}
function str(v: unknown, path: string): string {
  return typeof v === "string" && v.length > 0 ? v : fail(path, "not a string");
}
function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fail(path, "not a number in range");
}
function bool(v: unknown, path: string): boolean {
  return typeof v === "boolean" ? v : fail(path, "not a boolean");
}
function oneOf<T extends string>(v: unknown, values: readonly T[], path: string): T {
  return values.includes(v as T) ? (v as T) : fail(path, `not one of ${values.join(", ")}`);
}
function pattern(v: unknown, re: RegExp, path: string): string {
  const s = str(v, path);
  return re.test(s) ? s : fail(path, "malformed");
}
/** An optional field: absent stays absent, present must be valid */
function opt<T>(o: Obj, key: string, read: (v: unknown, path: string) => T, path: string): T | undefined {
  return o[key] === undefined ? undefined : read(o[key], `${path}.${key}`);
}

const CONDITIONS = Object.keys(CONDITION_NAMES) as (keyof typeof CONDITION_NAMES)[];
const INTENSITIES: readonly Intensity[] = ["light", "moderate", "heavy"];
const TREATMENTS: readonly Treatment[] = ["editorial", "monochrome", "chromatic"];
const FORMATS: readonly CreateFormat[] = ["a4", "story", "square"];
const LIVE_PROVIDERS: readonly WeatherProvider["name"][] = ["openweather", "openweather-free", "open-meteo", "mock"];
const ESTIMATED = ["humidity", "visibility"] as const;

function checkRecord(raw: unknown): CreateRecord {
  const r = obj(raw, "record");
  if (r.v !== CREATE_RECORD_VERSION) fail("v", typeof r.v === "number" ? `version ${r.v} unknown` : "missing");
  const record: CreateRecord = {
    v: CREATE_RECORD_VERSION,
    at: num(r.at, "at", ARCHIVE_FROM),
    timeZone: str(r.timeZone, "timeZone"),
    weather: checkWeather(obj(r.weather, "weather")),
    source: checkSource(obj(r.source, "source")),
    fetchedAt: num(r.fetchedAt, "fetchedAt", 0),
    design: checkDesign(obj(r.design, "design")),
  };
  checkCoherence(record);
  return record;
}

/**
 * The fields must tell one story (rule 7): a record read back, perhaps from an address edited by hand, never passes
 * a forecast for the present, a day for a moment, or the past for anything but a reconstruction of it.
 */
function checkCoherence({ at, timeZone, weather, source, fetchedAt }: CreateRecord): void {
  let day: string;
  try {
    day = localDay(at, timeZone);
  } catch {
    return fail("timeZone", "unknown");
  }
  if (weather.date !== day) fail("weather.date", "not the day of `at` in `timeZone`");
  if (source.kind === "current") {
    if (weather.allDay) fail("source.kind", "a whole day is not the current moment");
    if (Math.abs(at - fetchedAt) > CURRENT_TOLERANCE) fail("source.kind", "the current moment is not when the weather was read");
  }
  if (source.kind === "reconstruction") {
    if (at >= fetchedAt) fail("source.kind", "a reconstruction is of the past");
    if (source.method === "forecast-archive" && at < IFS_ARCHIVE_FROM) fail("source.method", "the forecast archive starts in 2017");
  }
}

function checkSource(s: Obj): RecordSource {
  const kind = oneOf(s.kind, ["current", "forecast", "reconstruction"] as const, "source.kind");
  if (kind === "reconstruction")
    return {
      provider: oneOf(s.provider, ["open-meteo-archive"] as const, "source.provider"),
      kind,
      method: oneOf(s.method, ["reanalysis", "forecast-archive"] as const, "source.method"),
      model: str(s.model, "source.model"),
      confidence: oneOf(s.confidence, ["high", "medium", "low"] as const, "source.confidence"),
    };
  return { provider: oneOf(s.provider, LIVE_PROVIDERS, "source.provider"), kind };
}

function checkDesign(d: Obj): CreateDesign {
  const show = obj(d.show, "design.show");
  const view = obj(d.view, "design.view");
  return {
    treatment: oneOf(d.treatment, TREATMENTS, "design.treatment"),
    format: oneOf(d.format, FORMATS, "design.format"),
    show: { temperature: bool(show.temperature, "design.show.temperature"), coordinates: bool(show.coordinates, "design.show.coordinates") },
    view: { zoom: fixed(view.zoom, BASE_VIEW.zoom, "design.view.zoom"), pitch: fixed(view.pitch, BASE_VIEW.pitch, "design.view.pitch"), bearing: fixed(view.bearing, BASE_VIEW.bearing, "design.view.bearing") },
  };
}

/** In v1 the view is the base view (ADR-018) */
function fixed(v: unknown, want: number, path: string): number {
  return v === want ? want : fail(path, "not the base view (fixed in v1)");
}

function checkWeather(w: Obj): RecordInput {
  const p = obj(w.place, "weather.place");
  const n = (key: string, min?: number, max?: number) => opt(w, key, (v, path) => num(v, path, min, max), "weather");
  const provenance = w.provenance === undefined ? undefined : checkProvenance(obj(w.provenance, "weather.provenance"));
  const input: RecordInput = {
    place: {
      name: str(p.name, "weather.place.name"),
      lat: num(p.lat, "weather.place.lat", -90, 90),
      lon: num(p.lon, "weather.place.lon", -180, 180),
      region: opt(p, "region", (v, path) => (typeof v === "string" ? v : fail(path, "not a string")), "weather.place"),
      country: opt(p, "country", (v, path) => (typeof v === "string" ? v : fail(path, "not a string")), "weather.place"),
    },
    date: pattern(w.date, /^\d{4}-\d{2}-\d{2}$/, "weather.date"),
    time: pattern(w.time, /^\d{2}:\d{2}$/, "weather.time"),
    zone: str(w.zone, "weather.zone"),
    allDay: opt(w, "allDay", bool, "weather"),
    condition: oneOf(w.condition, CONDITIONS, "weather.condition"),
    intensity: oneOf(w.intensity, INTENSITIES, "weather.intensity"),
    temp: num(w.temp, "weather.temp"),
    feelsLike: n("feelsLike"),
    high: n("high"),
    low: n("low"),
    windSpeed: n("windSpeed", 0),
    windGust: n("windGust", 0),
    windDeg: n("windDeg", 0, 360),
    humidity: n("humidity", 0, 100),
    visibility: n("visibility", 0),
    cloudCover: n("cloudCover", 0, 100),
    uv: n("uv", 0),
    precipitation: n("precipitation", 0),
    pressure: n("pressure", 0),
    light: n("light", -1, 2),
    provenance,
    credit: opt(w, "credit", str, "weather"),
  };
  // Absent stays absent: no key for a reading the record does not have
  for (const k of Object.keys(input) as (keyof RecordInput)[]) if (input[k] === undefined) delete input[k];
  for (const k of ["region", "country"] as const) if (input.place[k] === undefined) delete input.place[k];
  return input;
}

function checkProvenance(p: Obj): NonNullable<RecordInput["provenance"]> {
  const out: NonNullable<RecordInput["provenance"]> = {};
  const interpolated = opt(p, "interpolated", bool, "weather.provenance");
  const partialRange = opt(p, "partialRange", bool, "weather.provenance");
  if (interpolated !== undefined) out.interpolated = interpolated;
  if (partialRange !== undefined) out.partialRange = partialRange;
  if (p.estimated !== undefined) {
    if (!Array.isArray(p.estimated)) fail("weather.provenance.estimated", "not a list");
    out.estimated = (p.estimated as unknown[]).map((e, i) => oneOf(e, ESTIMATED, `weather.provenance.estimated.${i}`));
  }
  return out;
}
