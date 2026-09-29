/**
 * Normalized, provider-agnostic weather model. Everything the UI renders comes
 * from these types; raw provider payloads never leave their adapter.
 *
 * Units: temperatures in °C, wind in km/h, pressure in hPa, visibility in km,
 * precipitation in mm/h, probabilities 0..1, times as Unix seconds (UTC).
 */

export type Condition =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "thunderstorm"
  | "snow";

export type Intensity = "light" | "moderate" | "heavy";

export interface Place {
  name: string;
  /** State / region / province, when known */
  region?: string;
  /** ISO 3166 country code */
  country: string;
  lat: number;
  lon: number;
}

export interface CurrentWeather {
  time: number;
  temp: number;
  feelsLike: number;
  condition: Condition;
  intensity: Intensity;
  /** Human-readable, e.g. "Light rain" */
  description: string;
  /** Absent when the provider has no UV data */
  uvIndex?: number;
  windSpeed: number;
  windGust?: number;
  /** Meteorological degrees (0 = wind from the north) */
  windDeg: number;
  humidity: number;
  pressure: number;
  dewPoint: number;
  /** % */
  cloudCover: number;
  visibility: number;
  precipitation: number;
}

export interface MinutePoint {
  time: number;
  precipitation: number;
}

/** A 15-minute step; used to time near-term precipitation precisely. */
export interface QuarterPoint {
  time: number;
  condition: Condition;
  precipProbability: number;
  precipitation: number;
}

export interface HourlyPoint {
  time: number;
  temp: number;
  feelsLike: number;
  condition: Condition;
  intensity: Intensity;
  isNight: boolean;
  precipProbability: number;
  precipitation: number;
  windSpeed: number;
  windGust?: number;
  uvIndex?: number;
  pressure: number;
  /** % of sky covered */
  cloudCover: number;
}

export interface DailyPoint {
  time: number;
  min: number;
  max: number;
  condition: Condition;
  intensity: Intensity;
  precipProbability: number;
  uvIndex?: number;
  windGust?: number;
  /** True when min/max only cover part of the day (e.g. forecast starts mid-day) */
  partial?: boolean;
  sunrise?: number;
  sunset?: number;
  moonrise?: number;
  moonset?: number;
  /** 0 and 1 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter */
  moonPhase?: number;
}

/** Pollutant concentrations in μg/m³ */
export interface Pollutants {
  pm2_5: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
}

export interface AirQuality {
  time: number;
  /** 1 = Good … 5 = Very poor (OpenWeather's scale, after the European CAQI bands) */
  index: 1 | 2 | 3 | 4 | 5;
  pollutants: Pollutants;
}

/** An official warning, as issued by a national weather agency. */
export interface WeatherAlert {
  id: string;
  event: string;
  sender: string;
  start: number;
  end: number;
  description: string;
}

export interface WeatherData {
  place: Place;
  /** IANA zone ("Europe/Rome") or fixed UTC offset ("+02:00") of the place */
  timezone: string;
  sunrise: number;
  sunset: number;
  current: CurrentWeather;
  /** Next ~60 minutes of precipitation; null when the provider has none */
  minutely: MinutePoint[] | null;
  /** 15-minute steps for the next hours; null when the provider has none */
  quarterHourly: QuarterPoint[] | null;
  /** Upcoming forecast points; usually hourly, 3-hourly on coarser providers */
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  /** Null when the provider has no air-quality data */
  airQuality: AirQuality | null;
  /** Active official alerts; empty when none (or when the provider has none) */
  alerts: WeatherAlert[];
}
