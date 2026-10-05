import type { Geography, RecordInput } from "../types";
import tshuru from "./geography/tshuru.json";
import milan from "./geography/milan.json";
import tokyo from "./geography/tokyo.json";
import reykjavik from "./geography/reykjavik.json";
import cairo from "./geography/cairo.json";
import ulaanbaatar from "./geography/ulaanbaatar.json";
import oslo from "./geography/oslo.json";
import sanCristobal from "./geography/san-cristobal-de-las-casas.json";

export type SpikeRecord = { key: string; note: string; input: RecordInput; geography: Geography | null };

const geo = (g: unknown) => g as Geography;
const day = { date: "2026-10-05", time: "12:00" };

/**
 * The spike's test records (brief V3.1, section 32) and its edge cases. The weather is set by hand, not fetched:
 * Milan, Tshuru and Tokyo as on the Type Engine research's hand-made posters, the others plausible for the place,
 * except Ulaanbaatar's -24 °C on 5 October, which is the extreme-cold case, not the season.
 */
export const SPIKE_RECORDS: SpikeRecord[] = [
  {
    key: "tshuru",
    note: "31 °C clear",
    input: { place: { name: "Tshuru", lat: -4.4667, lon: 29.1 }, ...day, zone: "GMT+2", condition: "clear", intensity: "light", temp: 31, feelsLike: 33, high: 34, low: 24, windSpeed: 8, windDeg: 90, humidity: 42, uv: 8, cloudCover: 10, pressure: 1011 },
    geography: geo(tshuru),
  },
  {
    key: "milan",
    note: "8 °C fog",
    input: { place: { name: "Milan", lat: 45.4642, lon: 9.19 }, date: "2026-10-05", time: "07:00", zone: "GMT+2", light: 0.05, condition: "fog", intensity: "moderate", temp: 8, feelsLike: 6, high: 11, low: 5, windSpeed: 4, windDeg: 135, humidity: 97, visibility: 0.3, cloudCover: 100, pressure: 1021 },
    geography: geo(milan),
  },
  {
    key: "tokyo",
    note: "18 °C rain",
    input: { place: { name: "Tokyo", lat: 35.6812, lon: 139.7671 }, date: "2026-10-05", time: "18:00", zone: "GMT+9", light: 0.95, condition: "rain", intensity: "moderate", temp: 18, feelsLike: 17, high: 20, low: 16, windSpeed: 18, windDeg: 45, humidity: 88, precipitation: 6.2, cloudCover: 100, pressure: 1006 },
    geography: geo(tokyo),
  },
  {
    key: "reykjavik",
    note: "-3 °C snow",
    input: { place: { name: "Reykjavík", lat: 64.1466, lon: -21.9426 }, ...day, zone: "GMT+0", condition: "snow", intensity: "light", temp: -3, feelsLike: -9, high: -1, low: -5, windSpeed: 30, windDeg: 60, humidity: 85, precipitation: 0.4, cloudCover: 95, pressure: 998 },
    geography: geo(reykjavik),
  },
  {
    key: "cairo",
    note: "41 °C clear, extreme heat",
    input: { place: { name: "Cairo", lat: 30.0444, lon: 31.2357 }, ...day, zone: "GMT+3", condition: "clear", intensity: "light", temp: 41, feelsLike: 43, high: 42, low: 27, windSpeed: 14, windDeg: 340, humidity: 12, uv: 10, cloudCover: 0, pressure: 1008 },
    geography: geo(cairo),
  },
  {
    key: "ulaanbaatar",
    note: "-24 °C snow, extreme cold",
    input: { place: { name: "Ulaanbaatar", lat: 47.9184, lon: 106.9177 }, ...day, zone: "GMT+8", condition: "snow", intensity: "light", temp: -24, feelsLike: -31, high: -19, low: -29, windSpeed: 12, windDeg: 300, humidity: 70, precipitation: 0.1, cloudCover: 70, pressure: 1031 },
    geography: geo(ulaanbaatar),
  },
  {
    key: "oslo",
    note: "6 °C cloud, short name",
    input: { place: { name: "Oslo", lat: 59.9139, lon: 10.7522 }, ...day, zone: "GMT+2", condition: "cloudy", intensity: "moderate", temp: 6, feelsLike: 3, high: 8, low: 4, windSpeed: 16, windDeg: 220, humidity: 80, cloudCover: 92, pressure: 1012 },
    geography: geo(oslo),
  },
  {
    key: "san-cristobal",
    note: "14 °C storm, long name",
    input: { place: { name: "San Cristobal de las Casas", lat: 16.737, lon: -92.6376 }, ...day, zone: "GMT-6", condition: "thunderstorm", intensity: "heavy", temp: 14, feelsLike: 13, windSpeed: 34, windGust: 62, windDeg: 110, humidity: 92, precipitation: 9.5, cloudCover: 100, pressure: 1004 },
    geography: geo(sanCristobal),
  },
];

/** Edge cases: missing readings, no geography at all */
export const EDGE_RECORDS: SpikeRecord[] = [
  {
    key: "milan-no-visibility",
    note: "fog without a visibility reading",
    input: { ...SPIKE_RECORDS[1].input, visibility: undefined },
    geography: geo(milan),
  },
  {
    key: "tshuru-no-uv",
    note: "clear without UV",
    input: { ...SPIKE_RECORDS[0].input, uv: undefined },
    geography: geo(tshuru),
  },
  {
    key: "no-geography",
    note: "no usable geography: grid fallback",
    input: { ...SPIKE_RECORDS[6].input, place: { name: "Nowhere", lat: 0, lon: -140 } },
    geography: null,
  },
];
