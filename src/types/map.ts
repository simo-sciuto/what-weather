/** The cloud and rain grid the map animates: built on the server (lib/api/sources/cloud-grid), read by the browser */
export type CloudGrid = {
  /** Latitudes of the rows, north to south */
  lats: number[];
  /** Longitudes of the columns, west to east */
  lons: number[];
  /** Unix seconds of each hourly frame, from the current hour on */
  times: number[];
  /** Per frame, cloud cover (%) of every point, row by row */
  cloud: number[][];
  /** Per frame, precipitation (mm/h) of every point, row by row */
  precip: number[][];
};

/** Mapbox GL JS as the page loads it (once, on demand): the type of the library, not an import of it */
export type Mapbox = typeof import("mapbox-gl").default;
