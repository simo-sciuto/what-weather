import { placeHref } from "@/lib/place";
import { newestFirst, type KeptRecord } from "./kept-record";

/**
 * How Keep lists its records (ADR-028, W11): the newest three, and the total for the rest, which opens in place.
 * Pure: no storage, no React.
 */

export const KEPT_SHOWN = 3;

export type KeptList = {
  /** The newest records, up to `KEPT_SHOWN` */
  latest: KeptRecord[];
  /** The others, newest first; empty when everything fits */
  rest: KeptRecord[];
  total: number;
};

export function keptList(records: KeptRecord[], shown: number = KEPT_SHOWN): KeptList {
  const all = newestFirst(records);
  return { latest: all.slice(0, shown), rest: all.slice(shown), total: all.length };
}

/** The record as a moment of the page: the address of the place, with `t` when the record has a moment ("Adesso" has none) */
export function keptHref(record: KeptRecord): string {
  const href = placeHref(record.place);
  return record.t === null ? href : `${href}&t=${record.t}`;
}
