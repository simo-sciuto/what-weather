import { parsePlaceRef } from "@/lib/place";
import { weatherFor } from "@/lib/weather-page";
import { conditionLabel } from "@/lib/weather/formatters";
import { frameLook } from "@/lib/weather/look";
import { tempRange } from "@/lib/weather/today";
import type { PlaceSummary } from "@/types/place";
import type { NextRequest } from "next/server";

/**
 * A place in a few numbers, for the saved-places cards: its temperature, its
 * sky in words and in colour. Read through the shared weather cache, so a
 * card for a city someone just viewed costs nothing.
 */
export async function GET(request: NextRequest) {
  const ref = parsePlaceRef(Object.fromEntries(request.nextUrl.searchParams));
  if (!ref) return Response.json({ error: "Coordinate mancanti" }, { status: 400 });
  try {
    const { data, timeline } = await weatherFor(ref);
    const now = timeline.frames[0];
    const { palette: p } = frameLook(now);
    const range = tempRange(data);
    const summary: PlaceSummary = {
      temp: data.current.temp,
      high: range.max,
      low: range.min,
      label: conditionLabel(data.current),
      condition: data.current.condition,
      night: now.phase === "night",
      sky: [p.sky1, p.sky2, p.sky3],
    };
    return Response.json(summary, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch {
    return Response.json({ error: "Meteo non disponibile" }, { status: 502 });
  }
}
