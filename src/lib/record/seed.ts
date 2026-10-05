/**
 * Determinism (no Math.random): one seed per record, from its place, day and family. It only breaks ties between
 * choices the composition already scored as equal; it never picks a mode, a family, a scale or the hierarchy.
 */

/** FNV-1a, 32 bits */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, 0..1 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "San Cristóbal de las Casas" -> "SAN-CRISTOBAL-DE-LAS-CASAS" */
export function placeSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function recordSeed(placeName: string, isoDate: string, family: string): number {
  return hash32(placeSlug(placeName) + isoDate + family);
}
