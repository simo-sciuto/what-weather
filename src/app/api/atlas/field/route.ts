import { CACHE_CONTROL } from "@/constants/cache";
import { API_ERRORS } from "@/constants/labels";
import { getProvider } from "@/lib/api/providers/get-provider";
import { sampleField, weatherField } from "@/lib/api/sources/weather-field";
import { latticeFor } from "@/lib/atlas/lattice";
import type { NextRequest } from "next/server";

/**
 * The weather field of a view (Atlas, WTH-272, ADR-026): the colour of the weather of a lattice of places over the box
 * `west, south, east, north`, so the map can show Milano and Roma in their own weather and fade between them. The
 * lattice is worked out here, on a fixed grid and capped, whatever the box asks: a caller cannot ask for more places, or
 * for different ones, than the grid has. With the sample weather as provider the field is a made-up one, and not cached.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const [west, south, east, north] = ["west", "south", "east", "north"].map((k) => (q.get(k) === null || q.get(k) === "" ? NaN : Number(q.get(k))));
  if (![west, south, east, north].every(Number.isFinite) || Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 1000 || Math.abs(east) > 1000) {
    return Response.json({ error: API_ERRORS.missingCoordinates }, { status: 400 });
  }
  const lattice = latticeFor({ west, south, east, north });
  try {
    if (getProvider().name === "mock") return Response.json(sampleField(lattice), { headers: { "Cache-Control": "no-store" } });
    return Response.json(await weatherField(lattice.step, lattice.lats, lattice.lons), { headers: { "Cache-Control": CACHE_CONTROL.clouds } });
  } catch (error) {
    console.error("atlas field failed", lattice.step, error instanceof Error ? error.message : error);
    return Response.json({ error: API_ERRORS.weatherUnavailable }, { status: 502 });
  }
}
