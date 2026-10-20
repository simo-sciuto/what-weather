import { API_ERRORS } from "@/constants/labels";
import { CACHE_CONTROL } from "@/constants/cache";
import { getProvider } from "@/lib/api/providers/get-provider";
import { sampleSpot, spotWeather } from "@/lib/api/sources/route-weather";
import { roundCoord } from "@/lib/weather/coordinates";
import type { NextRequest } from "next/server";

/**
 * The weather at a summit (WTH-352, ADR-031): the point and its height, the model's estimate there for three days, for
 * the summit's card and its verdict. The point is rounded as the cache's cells are and the height to a band of 100 m, so
 * a caller cannot ask for more entries than the map has. With the sample weather as provider it is made up and not cached.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const [lat, lon, ele] = ["lat", "lon", "ele"].map((k) => (q.get(k) === null || q.get(k) === "" ? NaN : Number(q.get(k))));
  if (![lat, lon, ele].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || ele < -500 || ele > 9000) {
    return Response.json({ error: API_ERRORS.missingCoordinates }, { status: 400 });
  }
  const spot = { lat: roundCoord(lat), lon: roundCoord(lon), ele: Math.round(ele / 100) * 100 };
  try {
    if (getProvider().name === "mock") return Response.json(sampleSpot(spot), { headers: { "Cache-Control": "no-store" } });
    return Response.json(await spotWeather(spot.lat, spot.lon, spot.ele), { headers: { "Cache-Control": CACHE_CONTROL.clouds } });
  } catch (error) {
    console.error("atlas spot failed", spot, error instanceof Error ? error.message : error);
    return Response.json({ error: API_ERRORS.weatherUnavailable }, { status: 502 });
  }
}
