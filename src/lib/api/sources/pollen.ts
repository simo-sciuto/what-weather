import "server-only";
import { OPTIONAL_FETCH_TIMEOUT_MS } from "@/constants/network";
import { WEATHER_REVALIDATE_SECONDS } from "@/constants/cache";
import type { Pollen } from "@/types/weather";

/**
 * The pollen in the air right now, from Open-Meteo's air-quality service
 * (the Copernicus model, Europe only, in season), whatever provider the page
 * runs on. Elsewhere, or when it can't be reached in time, there is none and
 * the page does without.
 */

const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const SPECIES = ["alder_pollen", "birch_pollen", "olive_pollen", "grass_pollen", "mugwort_pollen", "ragweed_pollen"] as const;

type Current = { time: number } & Record<(typeof SPECIES)[number], number | null>;

export async function lookupPollen(lat: number, lon: number): Promise<Pollen | null> {
  try {
    const q = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timeformat: "unixtime",
      current: SPECIES.join(","),
    });
    const res = await fetch(`${AIR}?${q}`, {
      next: { revalidate: WEATHER_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(OPTIONAL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { current: c } = (await res.json()) as { current?: Current };
    // Outside the model's area every species comes back empty.
    if (!c || SPECIES.every((s) => c[s] == null)) return null;
    return {
      time: c.time,
      tree: (c.alder_pollen ?? 0) + (c.birch_pollen ?? 0) + (c.olive_pollen ?? 0),
      grass: c.grass_pollen ?? 0,
      weed: (c.mugwort_pollen ?? 0) + (c.ragweed_pollen ?? 0),
    };
  } catch {
    return null;
  }
}
