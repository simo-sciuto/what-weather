/**
 * The Atlas foundation (ADR-020): the map's camera, the point whose weather is asked for, and the point whose weather
 * is on show are three different things, kept apart.
 */

import type { SkyPalette } from "@/types/palette";

/** Where the map looks and how: the geographic camera. Never the weather point. */
export type Camera = { lng: number; lat: number; zoom: number; pitch: number; bearing: number };

/**
 * Who moved the camera: the person (a drag, a wheel, a key, inertia) or the code (a command given through the
 * camera port). Read from the event data the port attaches to its own commands, never from `originalEvent`, which
 * a wheel zoom does not carry (M0, S7).
 */
export type CameraOrigin = "user" | "program";

export type CameraEvent = {
  type: "movestart" | "move" | "moveend";
  /** The camera as it is when the event fires */
  camera: Camera;
  origin: CameraOrigin;
};

/** What a command may set; what it leaves out stays as it is */
export type CameraTarget = Partial<Camera>;

/** Padding around the map's viewport, in pixels: the map's centre is the centre of what is left */
export type CameraPadding = { top?: number; right?: number; bottom?: number; left?: number };

/** The map as the Atlas sees it: events out, tagged commands in. A fake stands in for it in tests. */
export type CameraPort = {
  /**
   * Hears the camera. `movestart` and `moveend` only, unless `frames` is set: a `move` fires every frame of a
   * movement and nothing that renders with React should listen to it.
   */
  subscribe: (listener: (event: CameraEvent) => void, options?: { frames?: boolean }) => () => void;
  get: () => Camera;
  /** The commands move the camera as `program`; with `reducedMotion` a flight or an ease is a jump */
  jumpTo: (target: CameraTarget) => void;
  easeTo: (target: CameraTarget, options?: { durationMs?: number; reducedMotion?: boolean }) => void;
  flyTo: (target: CameraTarget, options?: { durationMs?: number; reducedMotion?: boolean }) => void;
  setPadding: (padding: CameraPadding) => void;
};

/** A point as the cache knows it: coordinates rounded to about a kilometre (`roundCoord`, ADR-003) */
export type Cell = { lat: number; lon: number };

/**
 * What the Atlas is doing:
 *  - resting: the map is still and the point it rests on is the one on show (or none was asked for)
 *  - moving: the person is moving the map
 *  - settling: the movement ended and the quiet is running
 *  - loading: a point was asked for and its weather has not come
 *  - failed: the point asked for did not load; the weather on show is the previous one
 */
export type AtlasPhase = "resting" | "moving" | "settling" | "loading" | "failed";

/** Why a request failed, as the code that made it says; the controller only carries it */
export type FailureReason = "timeout" | "upstream" | "offline" | "unknown";

export type AtlasStatus = {
  phase: AtlasPhase;
  /** The point the map rested on when it last settled, or that was picked on purpose; null before any */
  candidate: Cell | null;
  /** The point whose weather is on show */
  loaded: Cell | null;
  /** The point being asked for now, if any (it can be loading while the map moves again) */
  inflight: Cell | null;
  /** The last request that failed, until a new one starts or a settle moves on */
  failed: { cell: Cell; reason: FailureReason } | null;
};

/** Why a point was asked for: the map settled, it was picked on purpose, or the person pressed "Riprova" */
export type CommitReason = "settle" | "select" | "retry";

/** A request the controller makes of its owner. Answer it with `resolve(seq, ...)`; `signal` aborts when it is superseded. */
export type CommitRequest = { seq: number; cell: Cell; reason: CommitReason; signal: AbortSignal };

export type CommitResult = { ok: true } | { ok: false; reason: FailureReason };

/**
 * A point's weather in the few numbers the Atlas shows, as `/api/atlas/point` answers (M4). The model's reading for the
 * cell, never an observation: the cell is the point, with no name borrowed from a town nearby.
 */
export type AtlasPoint = {
  cell: Cell;
  /** Where the cell is, from coarse to fine, as far as the geocoder knows; null where it knows nothing (the open sea) or cannot be asked */
  place: PlaceNames | null;
  /** The sky of the point's own weather, from the atmosphere engine, for the hour of the reading (M5) */
  sky: PointSky;
  /** IANA zone or fixed offset of the point */
  timezone: string;
  /** The provider the numbers come from ("openweather", "mock") */
  provider: string;
  /** The hour of the reading, Unix seconds */
  time: number;
  temp: number;
  /** The sky in words ("Sereno") */
  label: string;
  condition: string;
  night: boolean;
  /**
   * Every hour of the forecast the provider gave, in order (WTH-343): what the time bar moves over. The fields above are
   * the reading of "Adesso"; each hour carries its own sky, so a chosen hour colours the Atlas without asking again.
   */
  hours: AtlasHour[];
};

/** One hour of a point's forecast, as the Atlas shows it */
export type AtlasHour = {
  /** Unix seconds */
  time: number;
  temp: number;
  /** The sky in words ("Sereno") */
  label: string;
  condition: string;
  night: boolean;
  sky: PointSky;
};

/**
 * The names of the places a cell lies in, one per level, each present only if known. `nearKm` is how far the finest
 * name's own point is from the cell: a name far from the cell is the nearest place, not the place the cell is in.
 */
export type PlaceNames = { country?: string; region?: string; district?: string; place?: string; locality?: string; nearKm?: number };

/** What the page's sky is made of: the stops and the markers' colours, and the air the map is drawn in (`SkyPalette` without the map's inks, which the viewer's tuning redraws) */
export type PointSky = Pick<SkyPalette, "sky1" | "sky2" | "sky3" | "glass" | "glow" | "sun" | "cloud" | "air">;

/** What asking for a point comes to */
export type PointResult = { ok: true; point: AtlasPoint } | { ok: false; reason: FailureReason };

/** A box on the map, in degrees */
export type Bounds = { west: number; south: number; east: number; north: number };

/** A lattice of points on a fixed grid: `lats` from the south, `lons` from the west, a point is `lats[i]`, `lons[j]` at index `i * lons.length + j` */
export type Lattice = { step: number; lats: number[]; lons: number[] };

/**
 * The weather of a lattice of places as colours (`/api/atlas/field`, WTH-272): one colour and one temperature per point,
 * in the lattice's order. The colour is the weather's tone from the atmosphere engine, tinted by the temperature's scale;
 * it is a model's reading, interpolated between the points when drawn, never a measurement.
 */
export type WeatherField = Lattice & {
  provider: string;
  /** The hour of the reading, Unix seconds */
  time: number;
  colors: string[];
  temps: number[];
  /**
   * The next hours of the same places as colours (WTH-345), one entry per hour in order, each with a colour per place in
   * the lattice's order: what the time bar moves the map's colour over. Absent from an older answer; hours the field
   * does not reach are said, the colours of now are never shown as if they were another hour's.
   */
  hours?: FieldHour[];
};

/** One hour of the weather field: when, and a colour per place */
export type FieldHour = { time: number; colors: string[] };

