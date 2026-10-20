import type { MapOption } from "@/lib/map-options";
import { FIELD_OPACITY, FIELD_TINT_OPACITY } from "@/constants/atlas";

/**
 * The Atlas's three layers, one at a time (ADR-030, PRINCIPLES 2, WTH-346): each answers one question, and the weather
 * stays the map's colour in all three. `meteo` is the weather field at full strength over the viewer's own map;
 * `territorio` quiets the field so the land reads (relief, contours, water, woods); `percorsi` is the ground the routes
 * will be drawn on (WTH-353), said so until they are.
 */
export const LAYERS = ["meteo", "territorio", "percorsi"] as const;
export type AtlasLayer = (typeof LAYERS)[number];

export const LAYER_NAMES: Record<AtlasLayer, string> = { meteo: "Meteo", territorio: "Territorio", percorsi: "Percorsi" };

/** The layer an address names (`strato`); Meteo for none or for a word that is not a layer */
export function readLayer(search: string | URLSearchParams): AtlasLayer {
  const raw = (typeof search === "string" ? new URLSearchParams(search) : search).get("strato");
  return (LAYERS as readonly string[]).includes(raw ?? "") ? (raw as AtlasLayer) : "meteo";
}

/** The query string with the layer set; Meteo, the default, takes it out. The other parameters stay */
export function withLayer(search: string | URLSearchParams, layer: AtlasLayer): string {
  const params = new URLSearchParams(typeof search === "string" ? search : search.toString());
  params.delete("strato");
  if (layer !== "meteo") params.set("strato", layer);
  return params.toString();
}

export type LayerPlan = {
  /** What the map draws: the viewer's own choice in Meteo, the layer's own otherwise */
  options: MapOption[];
  /** The field under the map's lines and over them */
  fieldOpacity: number;
  tintOpacity: number;
};

const TERRITORY: readonly MapOption[] = ["water", "green", "relief", "contours", "main-roads", "peaks"];
const ROUTES_GROUND: readonly MapOption[] = ["water", "relief", "streets", "main-roads", "peaks"];

export function layerPlan(layer: AtlasLayer, viewerOptions: readonly MapOption[]): LayerPlan {
  if (layer === "territorio") return { options: [...TERRITORY], fieldOpacity: 0.55, tintOpacity: 0.18 };
  if (layer === "percorsi") return { options: [...ROUTES_GROUND], fieldOpacity: 0.6, tintOpacity: 0.22 };
  return { options: [...viewerOptions], fieldOpacity: FIELD_OPACITY, tintOpacity: FIELD_TINT_OPACITY };
}

/**
 * Where Territorio and Percorsi have their data first (ADR-030): Piedmont and the western Alps, a box that also holds
 * western Liguria, Valle d'Aosta, western Lombardy, Ticino, Valais and the French Alps from Savoie to the sea.
 */
export const REGION = { west: 5.8, south: 43.7, east: 9.6, north: 46.6 } as const;

export const inRegion = (lat: number, lon: number) => lat >= REGION.south && lat <= REGION.north && lon >= REGION.west && lon <= REGION.east;

/** The layer on show, held outside React like the moment, so the server and the first render agree on Meteo */
export type LayerStore = { get: () => AtlasLayer; set: (layer: AtlasLayer) => void; subscribe: (listener: () => void) => () => void };

export function createLayerStore(initial: AtlasLayer = "meteo"): LayerStore {
  let current = initial;
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
