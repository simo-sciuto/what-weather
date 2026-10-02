import { drawRandomCity } from "@/lib/weather/random-city";

/**
 * A city drawn at random from the world (see lib/weather/random-city): the
 * answer is different each time, so it is never cached.
 */
export async function GET() {
  const place = await drawRandomCity();
  if (!place)
    return Response.json(
      { error: "No city could be drawn right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json({ place }, { headers: { "Cache-Control": "no-store" } });
}
