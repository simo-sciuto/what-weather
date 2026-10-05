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
