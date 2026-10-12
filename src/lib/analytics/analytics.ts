/**
 * The product's measure points (ADR-018, WTH-226): the events the five weekly numbers are made of, named once, sent
 * nowhere yet. A placeholder on purpose: no service is chosen and no cookie, identifier or personal data is kept, so
 * nothing here can leak; connecting one is a call to `setAnalyticsSink` and nothing else in the app changes.
 */

/**
 * - `explore`: a visitor did something with a place's weather (moved the timeline, picked a day, opened the
 *   details, searched another place)
 * - `create_open`: the Create page was opened
 * - `preview_done`: a poster preview was drawn
 */
export type AnalyticsEvent = "explore" | "create_open" | "preview_done";

/** Only plain, non personal values: what was touched, never who or where */
export type AnalyticsProps = Record<string, string | number | boolean>;

export type AnalyticsSink = (event: AnalyticsEvent, props?: AnalyticsProps) => void;

let sink: AnalyticsSink | null = null;
const seen = new Set<AnalyticsEvent>();

/** Connects (or, with null, disconnects) the service that receives the events; forgets which were already sent. */
export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
  seen.clear();
}

/** Sends an event to the sink, if there is one. A failing sink never reaches the page. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    sink?.(event, props);
  } catch {
    // measuring must never break what is measured
  }
}

/** Like `track`, but once per page load: an event that says "this visitor did it", however often they do. */
export function trackOnce(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (seen.has(event)) return;
  seen.add(event);
  track(event, props);
}
