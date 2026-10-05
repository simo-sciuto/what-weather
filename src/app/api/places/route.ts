import { getProvider } from "@/lib/api/providers/get-provider";
import { GEOCODE_REVALIDATE_SECONDS, PLACES_REVALIDATE_SECONDS, CACHE_CONTROL } from "@/constants/cache";
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

/** Place names barely change: one geocoding call per query, shared by everyone typing it. */
async function search(q: string) {
  "use cache";
  cacheLife({ revalidate: PLACES_REVALIDATE_SECONDS, expire: GEOCODE_REVALIDATE_SECONDS });
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
      { headers: { "Cache-Control": CACHE_CONTROL.places } },
    );
  } catch {
    return Response.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
