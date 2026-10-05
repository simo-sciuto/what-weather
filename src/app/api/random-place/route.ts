import { CACHE_CONTROL } from "@/constants/cache";
import { drawRandomCity } from "@/lib/api/sources/random-city";

/**
 * A city drawn at random from the world (see lib/api/sources/random-city): the
 * answer is different each time, so it is never cached.
 */
export async function GET() {
  const place = await drawRandomCity();
  if (!place)
    return Response.json(
      { error: "No city could be drawn right now." },
      { status: 502, headers: { "Cache-Control": CACHE_CONTROL.noStore } },
    );
  return Response.json({ place }, { headers: { "Cache-Control": CACHE_CONTROL.noStore } });
}
