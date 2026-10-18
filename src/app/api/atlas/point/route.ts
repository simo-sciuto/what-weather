import { CACHE_CONTROL } from "@/constants/cache";
import { API_ERRORS } from "@/constants/labels";
import { reverseGeocode } from "@/lib/api/sources/reverse-geocode";
import { cellOf } from "@/lib/atlas/cell";
import { parsePlaceRef } from "@/lib/place";
import { weatherFor } from "@/lib/weather-page";
import { conditionLabel } from "@/lib/weather/formatters";
import { frameLook } from "@/lib/weather/look";
import type { AtlasPoint } from "@/types/atlas";
import type { NextRequest } from "next/server";

/**
 * The Atlas's check of a point (M4, ADR-022): the weather of the cell the map rested on, in the few numbers (and the sky
 * of its own weather) the Atlas shows. It reads through `weatherFor`, the same cache entry as the home page and the saved places, so a cell someone
 * has looked at costs nothing. It answers with the reading itself: the Atlas page does not fetch the weather again
 * (R2: on a serverless host a second fetch may not find this one's cache). A name in the query is ignored: a free
 * point is its coordinates. `mock` and `at` pick the sample weather and its hour, as on the home page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // An empty value is no coordinate (it would read as 0)
  const ref = params.get("lat") && params.get("lon") ? parsePlaceRef({ lat: params.get("lat"), lon: params.get("lon") }) : null;
  if (!ref) return Response.json({ error: API_ERRORS.missingCoordinates }, { status: 400 });
  const cell = cellOf(ref.lon, ref.lat);
  // `mock` and `at` are part of the cache key: with a live provider they change nothing but the key, so a caller could
  // make a fresh upstream load of the same cell at will. They count only where the sample weather is the provider.
  const sample = process.env.NODE_ENV !== "production" || process.env.WEATHER_PROVIDER === "mock";
  try {
    // The name of the place is asked beside the weather and never fails it: `reverseGeocode` gives null for anything
    const [{ data, timeline, provider }, place] = await Promise.all([
      weatherFor({ lat: cell.lat, lon: cell.lon }, sample ? (params.get("mock") ?? undefined) : undefined, sample ? (params.get("at") ?? undefined) : undefined),
      reverseGeocode(cell),
    ]);
    const { palette: p } = frameLook(timeline.frames[0]);
    const point: AtlasPoint = {
      cell,
      place,
      sky: { sky1: p.sky1, sky2: p.sky2, sky3: p.sky3, glass: p.glass, glow: p.glow, sun: p.sun, cloud: p.cloud, air: p.air },
      timezone: data.timezone,
      provider,
      time: data.current.time,
      temp: data.current.temp,
      label: conditionLabel(data.current),
      condition: data.current.condition,
      night: timeline.frames[0].phase === "night",
    };
    return Response.json(point, { headers: { "Cache-Control": sample ? "no-store" : CACHE_CONTROL.summary } });
  } catch (error) {
    console.error("atlas point failed", cell, error instanceof Error ? error.message : error);
    return Response.json({ error: API_ERRORS.weatherUnavailable }, { status: 502 });
  }
}
