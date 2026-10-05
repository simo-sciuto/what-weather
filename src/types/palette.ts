export type SkyPalette = {
  /** Top, middle and horizon of the sky gradient */
  sky1: string;
  sky2: string;
  sky3: string;
  /** Panel tint */
  glass: string;
  /** The light source's halo, and the solid colour of "now" markers */
  glow: string;
  sun: string;
  cloud: string;
  /** The city drawn behind the page, one entry per map layer */
  map: Record<MapLayer, MapInk>;
  /**
   * The weather's say on the map (WTH-046G/H): what `map` was drawn with. Carried with the palette so every consumer
   * that redraws the map (the viewer's tuning, the poster) draws it in the same air. `CLEAR_MAP` for the live page.
   */
  air: MapVisualState;
};

export type MapInk = {
  color: string;
  opacity: number;
  /** Layers that colour by value also carry a set of colours: the elevation's ramp (low to high), the traffic's one per rank of road (streets, main roads, motorways) */
  ramp?: string[];
};

/**
 * The first five are the city as it always is; the rest are the layers the
 * viewer may add (see map-options.ts), each coloured like the others.
 */
export type MapLayer =
  | "water"
  | "waterway"
  | "streets"
  | "main-roads"
  | "motorways"
  | "green"
  | "relief"
  | "contours"
  | "train"
  | "train-stops"
  | "metro"
  | "metro-stops"
  | "tram"
  | "tram-stops"
  | "bus-stops"
  | "buildings"
  | "buildings-3d"
  | "shadows"
  | "traffic-slow"
  | "traffic-heavy"
  | "traffic-jam"
  | "lights";

/**
 * What the weather does to the map's hierarchy (WTH-046G), the map half of the atmosphere: weights on the
 * planes (1 leaves a plane as it is), the chroma of every line, how far the land and the water move in
 * lightness, and the air's depth (WTH-046F). All of it is 1, or 0, in clear air.
 */
export type MapVisualState = {
  /** 1 clear air, 0 the thickest haze: see `atmosphereDepth` */
  depth: number;
  /** Opacity weights of the planes */
  waterWeight: number;
  roadWeight: number;
  buildingWeight: number;
  terrainWeight: number;
  /** Chroma multiplier of every line but the streets', the traffic's and the lights' own tones (the 3D volumes follow the flat buildings) */
  saturation: number;
  /** Lightness the ground gains, as snow brightens it; and the water loses, as rain deepens it */
  landLift: number;
  waterDeepen: number;
};
