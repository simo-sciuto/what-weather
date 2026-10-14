import type { Frame } from "@/types/timeline";

/**
 * What moment the page is asked to show. "Adesso" follows the clock; an instant is an absolute point in time
 * (Unix seconds, UTC), never a clock string such as "18:00": the same instant is a different local hour in a
 * different place (ADR-019).
 */
export type TimeSelection =
  | { mode: "now" }
  | {
      mode: "at";
      /** Unix seconds */
      instant: number;
      /** The IANA zone the instant was chosen in: reserved for display (M6), it never changes the instant */
      chosenIn?: string;
    };

/**
 * Why an instant cannot be shown at a place:
 *  - before-start: earlier than the first hour the forecast has
 *  - beyond-horizon: later than the last hour the forecast has
 *  - daily-only: on a day the forecast covers only with a daily summary (`Frame.overview`), which is no hour
 *  - gap: between two hours that are further apart than the tolerance
 *  - no-frames: the timeline has no hours at all
 *  - invalid: the instant is not a finite number (a bad value read from an address, say)
 */
export type UnavailableReason = "before-start" | "beyond-horizon" | "daily-only" | "gap" | "no-frames" | "invalid";

/**
 * The frame that answers an instant, or why there is none. Never a silent stand-in: an unavailable instant has
 * no frame, and the caller keeps the instant it asked for.
 */
export type MomentResolution =
  | {
      status: "ok";
      /** The instant asked for */
      requested: number;
      frame: Frame;
      /** Index into `Timeline.frames` */
      frameIndex: number;
      /** `frame.time - requested`, in seconds: how far the answering hour is from the instant */
      offsetSeconds: number;
      /** The frame is a provider's own point, not an hour worked out between two (mirrors `Frame.measured`) */
      measured: boolean;
    }
  | { status: "unavailable"; requested: number; reason: UnavailableReason };
