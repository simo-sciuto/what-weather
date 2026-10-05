/** The visual mood of the page. Drives palette, background and accents. */
export type WeatherState =
  | "CLEAR_DAY"
  | "CLEAR_NIGHT"
  | "PARTLY_CLOUDY"
  | "CLOUDY"
  | "FOG"
  | "RAIN"
  | "HEAVY_RAIN"
  | "STORM"
  | "SNOW";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export type SunEvent = {
  type: "sunrise" | "sunset";
  time: number;
};
