import { CACHE_CONTROL } from "@/constants/cache";
import { API_ERRORS } from "@/constants/labels";
import { cloudGrid } from "@/lib/api/sources/cloud-grid";
import type { NextRequest } from "next/server";

/** The cloud and precipitation grid the map animates, for the place at ?lat&lon. */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: API_ERRORS.missingCoordinates }, { status: 400 });
  }
  try {
    return Response.json(await cloudGrid(lat, lon), {
      headers: { "Cache-Control": CACHE_CONTROL.clouds },
    });
  } catch {
    return Response.json({ error: "Clouds are unavailable right now." }, { status: 502 });
  }
}
