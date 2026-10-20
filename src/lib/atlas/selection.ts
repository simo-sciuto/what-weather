/**
 * What the person tapped on the map (WTH-351): a summit for now. Held outside React like the moment and the layer;
 * choosing never moves the camera (PRINCIPLES 1), so the point being read does not change under the card.
 */
export type Selection = { kind: "peak"; name: string; ele: number | null; lat: number; lon: number } | null;

export type SelectionStore = { get: () => Selection; set: (s: Selection) => void; subscribe: (listener: () => void) => () => void };

export function createSelectionStore(): SelectionStore {
  let current: Selection = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next) {
      if (next === current) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A summit from a Mapbox Streets `natural_label` feature: its name, its height when the map gives one, its point */
export function peakOf(properties: Record<string, unknown> | null | undefined, lng: number, lat: number): Selection {
  const name = typeof properties?.name === "string" && properties.name ? properties.name : null;
  if (!name) return null;
  const raw = properties?.elevation_m;
  const ele = typeof raw === "number" && Number.isFinite(raw) ? raw : typeof raw === "string" && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  return { kind: "peak", name, ele, lat, lon: lng };
}
