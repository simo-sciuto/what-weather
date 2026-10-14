/**
 * What the end-to-end tests need to see of the Atlas, and only in a build made for them. The suite builds without a
 * Mapbox token (nothing it touches waits on a service), so the Atlas there draws its map over an empty style, from
 * Mapbox GL alone, with `NEXT_PUBLIC_ATLAS_BLANK_MAP=1`. Never in a build with a token, and never in production.
 */
export const ATLAS_TEST_MAP = !process.env.NEXT_PUBLIC_MAPBOX_TOKEN && process.env.NEXT_PUBLIC_ATLAS_BLANK_MAP === "1";

type Probe = { renders?: Record<string, number> };

/** Counts a render of a component, by name, for the tests that check nothing renders for every frame of a movement */
export function countRender(name: string): void {
  if (!ATLAS_TEST_MAP || typeof window === "undefined") return;
  const probe = window as unknown as Probe;
  probe.renders ??= {};
  probe.renders[name] = (probe.renders[name] ?? 0) + 1;
}
