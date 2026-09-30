import "server-only";
import { DEFAULT_PLACE, TYPICAL_CLOUD_COVER, isWet } from "./constants";
import { localHour } from "./formatters";
import type { WeatherProvider } from "./provider";
import type {
  AirQuality,
  Condition,
  DailyPoint,
  HourlyPoint,
  Intensity,
  MinutePoint,
  WeatherData,
} from "./types";

/**
 * Deterministic fake data for development without an API key. Each scenario
 * exercises a different weather state and narrative branch.
 */
export const MOCK_SCENARIOS = [
  "clear",
  "partly-cloudy",
  "cloudy",
  "rain-soon",
  "heavy-rain",
  "storm",
  "snow",
  "fog",
  "windy",
  "smog",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

interface Profile {
  mean: number;
  amplitude: number;
  /** Sky for each of the hours ahead */
  sky: (hoursFromNow: number) => { condition: Condition; intensity: Intensity; pop: number };
  /** Precipitation (mm/h) for each of the next 60 minutes; omit for no minute data */
  minutes?: (minute: number) => number;
  wind: number;
  gust: number;
  uvMax: number;
  humidity: number;
  visibility: number;
  clouds: number;
  description: string;
  /** Air quality index 1–5; pollutant levels are derived from it */
  aqi: AirQuality["index"];
  /** Pollen in grains/m³ (trees, grasses, weeds); omit for none in the air */
  pollen?: [number, number, number];
  /** A sample official alert, to exercise the alert component */
  alert?: { event: string; hours: number; description: string };
}

const dry = (condition: Condition, pop = 0.05) => () => ({
  condition,
  intensity: "moderate" as Intensity,
  pop,
});

const PROFILES: Record<MockScenario, Profile> = {
  clear: {
    mean: 21, amplitude: 6, sky: dry("clear"), wind: 8, gust: 14, uvMax: 7,
    humidity: 48, visibility: 10, clouds: 4, description: "Clear sky", aqi: 2,
  },
  "partly-cloudy": {
    mean: 19, amplitude: 5, sky: dry("partly-cloudy", 0.1), wind: 12, gust: 20, uvMax: 4,
    humidity: 58, visibility: 10, clouds: 40, description: "Scattered clouds", aqi: 2,
  },
  cloudy: {
    mean: 16, amplitude: 3, sky: dry("cloudy", 0.15), wind: 10, gust: 18, uvMax: 2,
    humidity: 72, visibility: 9, clouds: 92, description: "Overcast clouds", aqi: 2,
  },
  "rain-soon": {
    mean: 17, amplitude: 3,
    sky: (h) =>
      h < 1
        ? { condition: "cloudy", intensity: "moderate", pop: 0.4 }
        : h < 4
          ? { condition: "rain", intensity: "moderate", pop: 0.85 }
          : { condition: "cloudy", intensity: "moderate", pop: 0.2 },
    minutes: (m) => (m < 18 ? 0 : Math.min(2.4, 0.3 + (m - 18) * 0.08)),
    wind: 14, gust: 26, uvMax: 2, humidity: 80, visibility: 8, clouds: 95,
    description: "Overcast clouds", aqi: 1,
  },
  "heavy-rain": {
    mean: 14, amplitude: 2,
    sky: (h) =>
      h < 5
        ? { condition: "rain", intensity: "heavy", pop: 0.95 }
        : { condition: "rain", intensity: "light", pop: 0.6 },
    minutes: (m) => 9.5 - m * 0.08,
    wind: 18, gust: 38, uvMax: 1, humidity: 94, visibility: 4, clouds: 100,
    description: "Heavy intensity rain", aqi: 1,
  },
  storm: {
    mean: 22, amplitude: 4,
    sky: (h) =>
      h < 3
        ? { condition: "thunderstorm", intensity: "heavy", pop: 0.9 }
        : { condition: "rain", intensity: "light", pop: 0.5 },
    minutes: (m) => 8 - m * 0.1,
    wind: 30, gust: 72, uvMax: 3, humidity: 86, visibility: 5, clouds: 100,
    description: "Thunderstorm with heavy rain", aqi: 1,
    alert: {
      event: "Severe thunderstorm warning",
      hours: 5,
      description:
        "Thunderstorms with intense rainfall, hail and gusts up to 80 km/h. Avoid sheltering under trees; secure loose objects outdoors.",
    },
  },
  snow: {
    mean: -1, amplitude: 2, sky: () => ({ condition: "snow", intensity: "moderate", pop: 0.8 }),
    wind: 10, gust: 22, uvMax: 1, humidity: 90, visibility: 3, clouds: 100,
    description: "Snow", aqi: 1,
  },
  fog: {
    mean: 9, amplitude: 4,
    sky: (h) => (h < 4 ? dry("fog")() : dry("partly-cloudy")()),
    wind: 3, gust: 6, uvMax: 3, humidity: 98, visibility: 0.4, clouds: 60,
    description: "Fog", aqi: 3,
  },
  windy: {
    mean: 18, amplitude: 5, sky: dry("partly-cloudy", 0.1), wind: 38, gust: 64, uvMax: 5,
    humidity: 45, visibility: 10, clouds: 35, description: "Few clouds", aqi: 1,
    // A windy day in the grass season
    pollen: [6, 64, 12],
  },
  smog: {
    mean: 12, amplitude: 5, sky: dry("clear"), wind: 3, gust: 5, uvMax: 3,
    humidity: 70, visibility: 5, clouds: 5, description: "Haze", aqi: 4,
  },
};

function build(scenario: MockScenario, lat: number, lon: number, at?: string): WeatherData {
  const p = PROFILES[scenario];
  const timezone = "Europe/Rome";
  const now = mockNow(timezone, at);
  const midnight = Math.round(now - localHour(now, timezone) * 3600);
  const sunrise = midnight + 7.25 * 3600;
  const sunset = midnight + 19.2 * 3600;

  // Diurnal curve peaking around 15:00 local.
  const tempAt = (ts: number) =>
    p.mean + p.amplitude * Math.sin(((localHour(ts, timezone) - 9) / 24) * 2 * Math.PI);
  const isNightAt = (ts: number) => {
    const h = localHour(ts, timezone);
    return h < 7.25 || h > 19.2;
  };
  const uvAt = (ts: number) => {
    const h = localHour(ts, timezone);
    return isNightAt(ts) ? 0 : Math.max(0, p.uvMax * Math.sin(((h - 7.25) / 12) * Math.PI));
  };

  const firstHour = now - (now % 3600) + 3600;
  // Two days of hours: the next 24, and tomorrow whole, so a day picked in the week has its own.
  const hourly: HourlyPoint[] = Array.from({ length: 48 }, (_, i) => {
    const time = firstHour + i * 3600;
    const sky = p.sky(i + 1);
    const wet = isWet(sky.condition);
    return {
      time,
      temp: tempAt(time),
      feelsLike: tempAt(time) - p.wind / 20,
      condition: sky.condition,
      intensity: sky.intensity,
      isNight: isNightAt(time),
      precipProbability: sky.pop,
      precipitation: wet ? (sky.intensity === "heavy" ? 6 : 1.2) : 0,
      windSpeed: p.wind,
      windGust: p.gust,
      uvIndex: uvAt(time),
      pressure: 1016 - i * 0.2,
      cloudCover: TYPICAL_CLOUD_COVER[sky.condition],
    };
  });

  const minutely: MinutePoint[] | null = p.minutes
    ? Array.from({ length: 60 }, (_, m) => ({
        time: now - (now % 60) + m * 60,
        precipitation: Math.max(0, p.minutes!(m)),
      }))
    : null;

  const daily: DailyPoint[] = Array.from({ length: 8 }, (_, d) => ({
    time: midnight + d * 86400 + 12 * 3600,
    // Today follows the hourly curve exactly, so the reading never beats its own day's range;
    // later days vary a little around it.
    min: p.mean - p.amplitude + (d === 0 ? 0 : ((d * 7) % 5) - 2),
    max: p.mean + p.amplitude + (d === 0 ? 0 : ((d * 5) % 4) - 1),
    condition: d === 0 ? p.sky(1).condition : (["clear", "partly-cloudy", "cloudy", "rain"] as const)[d % 4],
    intensity: "moderate",
    precipProbability: d === 0 ? p.sky(1).pop : d % 4 === 3 ? 0.7 : 0.1,
    uvIndex: p.uvMax,
    windGust: p.gust,
    sunrise: sunrise + d * 86400,
    sunset: sunset + d * 86400,
    moonPhase: (0.54 + d / 29.5) % 1,
    // The moon rises ~50 minutes later each day.
    moonrise: midnight + d * 86400 + (18.6 + d * 0.83) * 3600,
    moonset: midnight + d * 86400 + (6.4 + d * 0.83) * 3600,
  }));

  const sky = p.sky(0);
  return {
    place: lat === DEFAULT_PLACE.lat && lon === DEFAULT_PLACE.lon
      ? DEFAULT_PLACE
      : { name: "Somewhere", country: "", lat, lon },
    timezone,
    sunrise,
    sunset,
    current: {
      time: now,
      temp: tempAt(now),
      feelsLike: tempAt(now) - p.wind / 20,
      condition: sky.condition,
      intensity: sky.intensity,
      description: p.description,
      uvIndex: uvAt(now),
      windSpeed: p.wind,
      windGust: p.gust,
      windDeg: 315,
      humidity: p.humidity,
      pressure: 1016,
      dewPoint: tempAt(now) - (100 - p.humidity) / 5,
      cloudCover: p.clouds,
      visibility: p.visibility,
      precipitation: minutely?.[0]?.precipitation ?? 0,
    },
    minutely,
    quarterHourly: null,
    hourly,
    daily,
    airQuality: {
      time: now,
      index: p.aqi,
      // Roughly the middle of each pollutant's band for that index.
      pollutants: {
        pm2_5: [5, 18, 38, 62, 90][p.aqi - 1],
        pm10: [12, 35, 75, 150, 230][p.aqi - 1],
        o3: [40, 80, 120, 160, 200][p.aqi - 1],
        no2: [15, 55, 110, 175, 230][p.aqi - 1],
        so2: [4, 30, 120, 300, 380][p.aqi - 1],
        co: [300, 5000, 10000, 13000, 16000][p.aqi - 1],
      },
    },
    pollen: p.pollen ? { time: now, tree: p.pollen[0], grass: p.pollen[1], weed: p.pollen[2] } : null,
    alerts: p.alert
      ? [
          {
            id: `sample-${scenario}`,
            event: p.alert.event,
            sender: "Sample weather service",
            start: now - 3600,
            end: now + p.alert.hours * 3600,
            description: p.alert.description,
          },
        ]
      : [],
  };
}

/** Real now, or today at "HH:MM" local time when reviewing other times of day. */
function mockNow(timeZone: string, at?: string): number {
  const now = Math.floor(Date.now() / 1000);
  const match = at?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return now;
  const target = Number(match[1]) + Number(match[2]) / 60;
  return Math.round(now + (target - localHour(now, timeZone)) * 3600);
}

export function isMockScenario(value: unknown): value is MockScenario {
  return MOCK_SCENARIOS.includes(value as MockScenario);
}

export function createMockProvider(
  scenario: MockScenario = "partly-cloudy",
  at?: string,
): WeatherProvider {
  return {
    name: "mock",
    async getByCoords(lat, lon) {
      return build(scenario, lat, lon, at);
    },
    async searchPlaces() {
      return [DEFAULT_PLACE];
    },
  };
}
