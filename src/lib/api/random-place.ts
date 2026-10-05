import type { PlaceRef } from "@/lib/place";

/** A city of the world drawn at random, from /api/random-place; null if none could be drawn. */
export async function fetchRandomPlace(): Promise<PlaceRef | null> {
  try {
    const res = await fetch("/api/random-place", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { place: PlaceRef }).place;
  } catch {
    return null;
  }
}
