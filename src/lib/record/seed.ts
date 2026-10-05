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

/** Letters that do not decompose into a base and an accent */
const FOLD: Record<string, string> = { Ł: "L", ł: "l", Ø: "O", ø: "o", Đ: "D", đ: "d", ß: "ss", Æ: "AE", æ: "ae", Œ: "OE", œ: "oe", Þ: "TH", þ: "th" };

/**
 * "San Cristóbal de las Casas" -> "SAN-CRISTOBAL-DE-LAS-CASAS". A name with no Latin letters at all keeps a
 * stable code from its own characters instead of an empty slug.
 */
export function placeSlug(name: string): string {
  const slug = name
    .replace(/[ŁłØøĐđßÆæŒœÞþ]/g, (ch) => FOLD[ch])
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `X${hash32(name.trim()).toString(36).toUpperCase()}`;
}

export function recordSeed(placeName: string, isoDate: string, family: string): number {
  return hash32(placeSlug(placeName) + isoDate + family);
}
