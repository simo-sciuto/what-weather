import { cacheLife } from "next/cache";

/**
 * A few facts about a place, for its "Territorio" chapter: what rank of place
 * it is, its altitude, how many live there, the towns around it, and its
 * waters and peaks.
 *
 * Mapbox finds the municipality (reverse geocoding: its point and its Wikidata
 * id) and says what it is (Tilequery: the city's own map label). Wikidata, a
 * curated source, says the rest: the official altitude (else Mapbox's terrain
 * contours give one), the population, the waters the town stands on (its
 * "located next to body of water", so Rome's Tiber and Como's lake, not the
 * nearest ditch), and the best-known lakes, peaks and towns around, by how many
 * Wikipedias write about them. No distances: only what the place is known by.
 *
 * Every fact is optional: whatever can't be had is simply left out.
 */
export interface CityFacts {
  /** "Capoluogo di provincia", "Capitale", "Città", "Paese"… */
  rank?: string;
  /** Metres above sea level: the municipality's official figure, else the terrain's 10-metre contours */
  altitude?: number;
  /** Inhabitants, and the year counted */
  population?: { count: number; year?: number };
  /** The waters the place stands on, best known first, then the best-known lakes around: "Adige", "Lago di Caldonazzo" */
  waters?: string[];
  /** The best-known peaks around, with their height when known */
  peaks?: { name: string; elevation?: number }[];
  /** The best-known towns around, far enough to have a weather of their own */
  nearby?: { name: string; lat: number; lon: number }[];
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
/**
 * The site's own address, sent as the referrer: a Mapbox token restricted to
 * the site's domains (as it should be) is refused to requests that name none.
 */
const SITE =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

/** Wikimedia asks every client to name itself. */
const WIKIMEDIA = { "User-Agent": `what-weather/1.0 (${SITE})`, Accept: "application/json" };

/** Places don't move: a month between checks, a year before a fact is dropped. */
const REVALIDATE = 60 * 60 * 24 * 30;
const EXPIRE = 60 * 60 * 24 * 365;

/**
 * How far around to look, in km: a lake's point on Wikidata is its middle,
 * so a big one's lies far out from the towns on its shores (Lake Como's is
 * some 26 km from Como), and lakes are looked for further out than peaks.
 */
const PEAKS_KM = 25;
const LAKES_KM = 35;
/** How many to name at most. */
const MAX_PEAKS = 4;
const MAX_WATERS = 4;
/** A peak or lake written about by fewer Wikipedias than this isn't one the place is known by. */
const MIN_SITELINKS = 5;
/** Wikidata's classes: mountain, lake. */
const MOUNTAIN = "Q8502";
const LAKE = "Q23397";
/**
 * Towns around: within this many km, at least this far from the place (closer
 * ones share its weather, or are its own districts) and from each other.
 */
const TOWNS_KM = 50;
const TOWNS_APART_KM = 10;
const MAX_TOWNS = 5;
/** A town counts from this many inhabitants, written about by this many Wikipedias. */
const TOWN_POPULATION = 10_000;
const TOWN_SITELINKS = 15;
/** Wikidata's classes: human settlement, municipality (an Italian comune is only the second). */
const SETTLEMENT = "Q486972";
const MUNICIPALITY = "Q15284";

type Props = Record<string, unknown> & { tilequery?: { distance?: number } };
type Feature = { properties: Props };

/**
 * One request, cached on its own for as long as places don't change. A
 * failure (an error, a slow answer) throws, and a throw is never cached: the
 * next visit asks again, instead of a month of blanks.
 */
async function cachedJson(url: string, headers: Record<string, string>): Promise<unknown> {
  "use cache";
  cacheLife({ revalidate: REVALIDATE, expire: EXPIRE });
  // Wikidata's queries over an area take a while; a map API answers at once.
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(url.includes("query.wikidata.org") ? 15_000 : 8_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    return (await cachedJson(url, headers)) as T;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const isEntityId = (id: string) => /^Q\d+$/.test(id);

/* ---------- Mapbox ---------- */

function tilequery(tileset: string, lat: number, lon: number, params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, access_token: TOKEN ?? "" });
  return getJson<{ features: Feature[] }>(`https://api.mapbox.com/v4/${tileset}/tilequery/${lon},${lat}.json?${q}`, {
    Referer: SITE,
  }).then((r) => r?.features ?? []);
}

/** The municipality containing the point: where Mapbox puts it, and its Wikidata id. */
async function municipalityOf(lat: number, lon: number): Promise<{ lat: number; lon: number; wikidata?: string } | null> {
  const q = new URLSearchParams({ longitude: String(lon), latitude: String(lat), types: "place", limit: "1", access_token: TOKEN ?? "" });
  type Geocoded = {
    properties?: {
      coordinates?: { latitude: number; longitude: number };
      wikidata_id?: string;
      context?: { place?: { wikidata_id?: string } };
    };
  };
  const res = await getJson<{ features?: Geocoded[] }>(`https://api.mapbox.com/search/geocode/v6/reverse?${q}`, { Referer: SITE });
  const p = res?.features?.[0]?.properties;
  if (!p?.coordinates) return null;
  return { lat: p.coordinates.latitude, lon: p.coordinates.longitude, wikidata: p.context?.place?.wikidata_id ?? p.wikidata_id };
}

/** Mapbox Streets' settlement types, in Italian. */
const KINDS: Record<string, string> = {
  city: "Città",
  town: "Cittadina",
  village: "Paese",
  hamlet: "Frazione",
  suburb: "Quartiere",
  quarter: "Quartiere",
  neighbourhood: "Quartiere",
};

/**
 * The city's own map label, looked for where Mapbox places the municipality
 * (a big city's centre is crowded with district labels, so the search stays
 * tight around that point): the one of the same name in any of its languages,
 * else the nearest town or city, never a district. A capital by the admin
 * level it heads (2 a country, 3 and 4 a region or state, 5 and 6 a province),
 * otherwise by its size.
 */
function rankOf(labels: Feature[], name: string): string | undefined {
  const lower = name.toLowerCase();
  const named = (f: Feature) =>
    Object.entries(f.properties).some(([k, v]) => (k === "name" || k.startsWith("name_")) && str(v).toLowerCase() === lower);
  const sorted = [...labels].sort((a, b) => (a.properties.tilequery?.distance ?? 0) - (b.properties.tilequery?.distance ?? 0));
  const label =
    sorted.find((f) => str(f.properties.class).startsWith("settlement") && named(f)) ??
    sorted.find((f) => str(f.properties.class) === "settlement");
  if (!label) return undefined;
  const capital = Number(label.properties.capital);
  if (capital === 2) return "Capitale";
  if (capital === 3 || capital === 4) return "Capoluogo di regione";
  if (capital === 5 || capital === 6) return "Capoluogo di provincia";
  return KINDS[str(label.properties.type)];
}

/** The highest 10-metre contour the point lies within. */
function altitudeOf(contours: Feature[]): number | undefined {
  const heights = contours.map((f) => Number(f.properties.ele)).filter(Number.isFinite);
  return heights.length ? Math.max(0, ...heights) : undefined;
}

/* ---------- Wikidata ---------- */

type Claim<V> = {
  rank: "preferred" | "normal" | "deprecated";
  mainsnak: { datavalue?: { value: V } };
  qualifiers?: { P585?: { datavalue?: { value: { time: string } } }[] };
};
type Entity = {
  claims?: { P1082?: Claim<{ amount: string }>[]; P2044?: Claim<{ amount: string }>[]; P206?: Claim<{ id: string }>[] };
  labels?: Record<string, { value: string }>;
  sitelinks?: Record<string, unknown>;
};

async function entities(ids: string[], props: string): Promise<Record<string, Entity>> {
  const q = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props, languages: "it|en", format: "json" });
  const res = await getJson<{ entities?: Record<string, Entity> }>(`https://www.wikidata.org/w/api.php?${q}`, WIKIMEDIA);
  return res?.entities ?? {};
}

const current = <V>(claims: Claim<V>[] = []) => {
  const live = claims.filter((c) => c.rank !== "deprecated" && c.mainsnak.datavalue);
  const preferred = live.filter((c) => c.rank === "preferred");
  return preferred.length ? preferred : live;
};

/** The latest population count on the item (P1082), preferred counts first. */
function populationOf(item: Entity): CityFacts["population"] {
  const yearOf = (c: Claim<unknown>) => Number(c.qualifiers?.P585?.[0]?.datavalue?.value.time.slice(1, 5)) || 0;
  const best = current(item.claims?.P1082).sort((a, b) => yearOf(b) - yearOf(a))[0];
  const count = Math.round(Number(best?.mainsnak.datavalue?.value.amount));
  return Number.isFinite(count) && count > 0 ? { count, year: yearOf(best) || undefined } : undefined;
}

/** The official altitude on the item (P2044), in metres. */
function altitudeOfItem(item: Entity): number | undefined {
  const metres = Math.round(Number(current(item.claims?.P2044)[0]?.mainsnak.datavalue?.value.amount));
  return Number.isFinite(metres) ? metres : undefined;
}

type Named = { id: string; name: string };

/** The waters the item stands on (P206), named in Italian, the best known (most Wikipedias) first. */
async function watersOf(item: Entity): Promise<Named[]> {
  const ids = current(item.claims?.P206)
    .map((c) => c.mainsnak.datavalue?.value.id ?? "")
    .filter(isEntityId)
    .slice(0, 10);
  if (!ids.length) return [];
  const found = await entities(ids, "labels|sitelinks");
  return ids
    .filter((id) => found[id]?.labels?.it ?? found[id]?.labels?.en)
    .sort((a, b) => Object.keys(found[b].sitelinks ?? {}).length - Object.keys(found[a].sitelinks ?? {}).length)
    .map((id) => ({ id, name: (found[id].labels!.it ?? found[id].labels!.en).value }));
}

/**
 * The best-known items of a class (mountains, lakes) within `km`, by how many
 * Wikipedias write about them, with their height when recorded.
 */
async function bestKnownNear(
  cls: string,
  lat: number,
  lon: number,
  km: number,
  limit: number,
): Promise<(Named & { elevation?: number })[]> {
  // Any kind of the class ("glacial lake" is a lake), grouped by item: one with several
  // recorded heights (or places) would otherwise come back once for each.
  const query = `
    SELECT ?item ?itemLabel (MAX(?height) AS ?elevation) (MAX(?count) AS ?links) WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?where .
        bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${km}" .
      }
      ?item wdt:P31/wdt:P279* wd:${cls} ; wikibase:sitelinks ?count .
      FILTER(?count >= ${MIN_SITELINKS})
      OPTIONAL { ?item wdt:P2044 ?height }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en" . }
    } GROUP BY ?item ?itemLabel ORDER BY DESC(?links) LIMIT ${limit}`;
  type Row = { item: { value: string }; itemLabel?: { value: string }; elevation?: { value: string } };
  const res = await getJson<{ results?: { bindings?: Row[] } }>(
    `https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" })}`,
    WIKIMEDIA,
  );
  return (
    (res?.results?.bindings ?? [])
      .map((r) => ({
        id: r.item.value.split("/").pop() ?? "",
        name: r.itemLabel?.value ?? "",
        elevation: Math.round(Number(r.elevation?.value)) || undefined,
      }))
      // An item with no label in either language comes back named by its id.
      .filter((p) => p.name && !isEntityId(p.name))
  );
}

const EARTH_KM = 6371;
/** Great-circle distance in km. */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * The best-known towns around (by how many Wikipedias write about them), each
 * far enough from the place and from the ones already chosen: Bergamo, Como,
 * Monza, Varese and Pavia for Milan, not its own districts nor five suburbs
 * side by side.
 */
async function townsNear(lat: number, lon: number): Promise<NonNullable<CityFacts["nearby"]>> {
  const query = `
    SELECT ?item ?itemLabel (SAMPLE(?where) AS ?at) (MAX(?count) AS ?links) WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?where .
        bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${TOWNS_KM}" .
      }
      ?item wdt:P1082 ?population ; wikibase:sitelinks ?count .
      FILTER(?population >= ${TOWN_POPULATION} && ?count >= ${TOWN_SITELINKS})
      VALUES ?class { wd:${SETTLEMENT} wd:${MUNICIPALITY} }
      ?item wdt:P31/wdt:P279* ?class .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en" . }
    } GROUP BY ?item ?itemLabel ORDER BY DESC(?links) LIMIT 40`;
  type Row = { itemLabel?: { value: string }; at?: { value: string } };
  const res = await getJson<{ results?: { bindings?: Row[] } }>(
    `https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" })}`,
    WIKIMEDIA,
  );
  const towns: NonNullable<CityFacts["nearby"]> = [];
  for (const r of res?.results?.bindings ?? []) {
    // Wikidata writes a point as "Point(9.67 45.695)": longitude first.
    const point = r.at?.value.match(/^Point\((-?[\d.]+) (-?[\d.]+)\)$/);
    const name = r.itemLabel?.value ?? "";
    if (!point || !name || isEntityId(name)) continue;
    const town = { name, lat: Number(point[2]), lon: Number(point[1]) };
    if ([{ lat, lon }, ...towns].some((t) => distanceKm(t, town) < TOWNS_APART_KM)) continue;
    towns.push(town);
    if (towns.length === MAX_TOWNS) break;
  }
  return towns;
}

/* ---------- Together ---------- */

/** Each request is cached on its own (see cachedJson), so a fact that failed is asked for again next time. */
export async function cityFacts(lat: number, lon: number, name: string): Promise<CityFacts> {
  if (!TOKEN) return {};

  const [town, contours, peaks, lakes, nearby] = await Promise.all([
    municipalityOf(lat, lon),
    tilequery("mapbox.mapbox-terrain-v2", lat, lon, { layers: "contour", limit: "50" }),
    bestKnownNear(MOUNTAIN, lat, lon, PEAKS_KM, MAX_PEAKS),
    bestKnownNear(LAKE, lat, lon, LAKES_KM, MAX_WATERS),
    townsNear(lat, lon),
  ]);
  const at = town ?? { lat, lon };
  const [labels, item] = await Promise.all([
    tilequery("mapbox.mapbox-streets-v8", at.lat, at.lon, { layers: "place_label", radius: "1500", limit: "50" }),
    town?.wikidata && isEntityId(town.wikidata) ? entities([town.wikidata], "claims").then((e) => e[town.wikidata!]) : undefined,
  ]);

  // The waters the town stands on first, then the lakes around it is known for (each once).
  const own = item ? await watersOf(item) : [];
  const waters = [...own, ...lakes.filter((l) => !own.some((w) => w.id === l.id))].slice(0, MAX_WATERS).map((w) => w.name);

  return {
    rank: rankOf(labels, name),
    altitude: (item && altitudeOfItem(item)) ?? altitudeOf(contours),
    population: item ? populationOf(item) : undefined,
    waters: waters.length ? waters : undefined,
    peaks: peaks.length ? peaks.map(({ name, elevation }) => ({ name, elevation })) : undefined,
    nearby: nearby.length ? nearby : undefined,
  };
}
