/**
 * The Atlas foundation (ADR-020): the map's camera, the point whose weather is asked for, and the point whose weather
 * is on show are three different things, kept apart.
 */

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
};

/** What asking for a point comes to */
export type PointResult = { ok: true; point: AtlasPoint } | { ok: false; reason: FailureReason };
