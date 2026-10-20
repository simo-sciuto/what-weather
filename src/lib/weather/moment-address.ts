import { MAX_INSTANT, MIN_INSTANT } from "@/constants/moment";
import { momentStart, type MomentStart } from "./moment";
import { resolveInstant, type InstantSource } from "./instant";
import { NOW_SELECTION } from "./instant";
import type { TimeSelection, UnavailableReason } from "@/types/time";

/**
 * The page's moment in its address (ADR-028): `t`, Unix seconds, the same name `/crea` already reads (WTH-236).
 * No `t` is "Adesso". Read on the client, so moving the moment only rewrites the address (`history.replaceState`)
 * and never asks the server for the page again.
 *
 * Pure: no window, no clock, no React.
 */

/** What an address says about the moment: nothing (Adesso), an instant, or something that is not one */
export type AddressMoment = { kind: "now" } | { kind: "at"; instant: number } | { kind: "invalid"; raw: string };

/** Reads `t` from a query string or a `URLSearchParams`; with two `t` the first counts */
export function readMoment(search: string | URLSearchParams): AddressMoment {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const raw = params.get("t");
  if (raw === null || raw === "") return { kind: "now" };
  if (!/^\d{1,12}$/.test(raw)) return { kind: "invalid", raw };
  const instant = Number(raw);
  return instant >= MIN_INSTANT && instant <= MAX_INSTANT ? { kind: "at", instant } : { kind: "invalid", raw };
}

/** The selection an address asks for: "Adesso" when it has no moment, and for a bad one (said as unavailable elsewhere) */
export function selectionOfAddress(moment: AddressMoment): TimeSelection {
  return moment.kind === "at" ? { mode: "at", instant: moment.instant } : NOW_SELECTION;
}

/**
 * The query string with the moment set (`t` for an instant, none for "Adesso"); the other parameters, their values and
 * their order stay (it is written again by `URLSearchParams`, so a space reads `+` and a comma `%2C`: the same meaning).
 */
export function withMoment(search: string | URLSearchParams, selection: TimeSelection): string {
  const params = new URLSearchParams(typeof search === "string" ? search : search.toString());
  params.delete("t");
  if (selection.mode === "at") params.set("t", String(selection.instant));
  return params.toString();
}

/**
 * What the address's moment shows at a place:
 *  - `now`: nothing asked, the live reading;
 *  - `ok`: the hour that answers it, as the position the page opens on (`start`);
 *  - `unavailable`: the place's forecast does not hold it (before it, after it, a gap, a day with no hours, or not a
 *    moment at all). Never answered with another hour: the page says so and keeps the instant that was asked for.
 */
export type AddressResolution =
  | { status: "now" }
  | { status: "ok"; requested: number; start: MomentStart }
  | { status: "unavailable"; requested: number | null; reason: UnavailableReason };

export function resolveAddressMoment(source: InstantSource, moment: AddressMoment): AddressResolution {
  if (moment.kind === "now") return { status: "now" };
  if (moment.kind === "invalid") return { status: "unavailable", requested: null, reason: "invalid" };
  const found = resolveInstant(source, moment.instant);
  if (found.status === "unavailable") return { status: "unavailable", requested: moment.instant, reason: found.reason };
  // The first hour is the live reading (`start.live`), as in Create: a `t` equal to it opens on "Adesso" and follows the clock
  const start = momentStart(source.timeline, found.frame.time);
  // The hour answers the instant but the timeline has no place for it to open on: still not something to show
  if (!start) return { status: "unavailable", requested: moment.instant, reason: "gap" };
  return { status: "ok", requested: moment.instant, start };
}
