import { getProvider } from "@/lib/weather";
import { GEOCODE_REVALIDATE_SECONDS } from "@/lib/weather/constants";
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

/** Place names barely change: one geocoding call per query, shared by everyone typing it. */
async function search(q: string) {
  "use cache";
  cacheLife({ revalidate: 60 * 60 * 24, expire: GEOCODE_REVALIDATE_SECONDS });
  return getProvider().searchPlaces(q);
}

/**
 * Location search for the client. Runs on the server so the provider key
 * never reaches the browser; the client only ever sees normalized places.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ places: [] });

  try {
    const places = await search(q.toLowerCase());
    return Response.json(
      { places },
      // Place names barely change: let the browser and any CDN reuse answers.
      { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
