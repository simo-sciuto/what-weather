/** What a saved place's card shows: built by /api/summary, read by the saved-places cards */
export type PlaceSummary = {
  temp: number;
  high: number;
  low: number;
  label: string;
  condition: string;
  night: boolean;
  sky: [string, string, string];
};

/** Coordinates plus any names we trust for display; the provider fills the rest. */
export type PlaceRef = {
  lat: number;
  lon: number;
  name?: string;
  region?: string;
  country?: string;
};
