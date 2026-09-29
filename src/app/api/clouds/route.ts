import { cloudGrid } from "@/lib/weather/cloud-grid";
import type { NextRequest } from "next/server";

/** The cloud and precipitation grid the map animates, for the place at ?lat&lon. */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "Coordinate mancanti" }, { status: 400 });
  }
  try {
    return Response.json(await cloudGrid(lat, lon), {
      headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" },
    });
  } catch {
    return Response.json({ error: "Clouds are unavailable right now." }, { status: 502 });
  }
}
