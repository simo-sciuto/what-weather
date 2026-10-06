import type { PlaceRef } from "@/types/place";

/**
 * Where a visit to the bare address lands: a city drawn from this list, one
 * from every kind of sky (polar, tropical, desert, monsoon, oceanic), so a
 * refresh shows another poster. Names as the interface says them.
 */
export const RANDOM_PLACES: readonly PlaceRef[] = [
  { name: "Milano", region: "Lombardia", country: "IT", lat: 45.46, lon: 9.19 },
  { name: "Roma", region: "Lazio", country: "IT", lat: 41.9, lon: 12.5 },
  { name: "Napoli", region: "Campania", country: "IT", lat: 40.85, lon: 14.27 },
  { name: "Palermo", region: "Sicilia", country: "IT", lat: 38.12, lon: 13.36 },
  { name: "Torino", region: "Piemonte", country: "IT", lat: 45.07, lon: 7.69 },
  { name: "Parigi", region: "Île-de-France", country: "FR", lat: 48.86, lon: 2.35 },
  { name: "Londra", region: "Inghilterra", country: "GB", lat: 51.51, lon: -0.13 },
  { name: "Edimburgo", region: "Scozia", country: "GB", lat: 55.95, lon: -3.19 },
  { name: "Lisbona", region: "Lisbona", country: "PT", lat: 38.72, lon: -9.14 },
  { name: "Amsterdam", region: "Olanda Settentrionale", country: "NL", lat: 52.37, lon: 4.9 },
  { name: "Berlino", region: "Berlino", country: "DE", lat: 52.52, lon: 13.4 },
  { name: "Praga", region: "Praga", country: "CZ", lat: 50.08, lon: 14.44 },
  { name: "Vienna", region: "Vienna", country: "AT", lat: 48.21, lon: 16.37 },
  { name: "Copenaghen", region: "Hovedstaden", country: "DK", lat: 55.68, lon: 12.57 },
  { name: "Oslo", region: "Oslo", country: "NO", lat: 59.91, lon: 10.75 },
  { name: "Helsinki", region: "Uusimaa", country: "FI", lat: 60.17, lon: 24.94 },
  { name: "Reykjavik", region: "Capitale", country: "IS", lat: 64.15, lon: -21.94 },
  { name: "Atene", region: "Attica", country: "GR", lat: 37.98, lon: 23.73 },
  { name: "Istanbul", region: "Istanbul", country: "TR", lat: 41.01, lon: 28.98 },
  { name: "Il Cairo", region: "Cairo", country: "EG", lat: 30.04, lon: 31.24 },
  { name: "Marrakech", region: "Marrakech-Safi", country: "MA", lat: 31.63, lon: -8.01 },
  { name: "Lagos", region: "Lagos", country: "NG", lat: 6.52, lon: 3.38 },
  { name: "Nairobi", region: "Nairobi", country: "KE", lat: -1.29, lon: 36.82 },
  { name: "Città del Capo", region: "Capo Occidentale", country: "ZA", lat: -33.92, lon: 18.42 },
  { name: "Dubai", region: "Dubai", country: "AE", lat: 25.2, lon: 55.27 },
  { name: "Mumbai", region: "Maharashtra", country: "IN", lat: 19.08, lon: 72.88 },
  { name: "Bangkok", region: "Bangkok", country: "TH", lat: 13.76, lon: 100.5 },
  { name: "Singapore", region: "Singapore", country: "SG", lat: 1.35, lon: 103.82 },
  { name: "Seul", region: "Seul", country: "KR", lat: 37.57, lon: 126.98 },
  { name: "Tokyo", region: "Tokyo", country: "JP", lat: 35.68, lon: 139.69 },
  { name: "Ulan Bator", region: "Ulan Bator", country: "MN", lat: 47.89, lon: 106.91 },
  { name: "Sydney", region: "Nuovo Galles del Sud", country: "AU", lat: -33.87, lon: 151.21 },
  { name: "Auckland", region: "Auckland", country: "NZ", lat: -36.85, lon: 174.76 },
  { name: "Honolulu", region: "Hawaii", country: "US", lat: 21.31, lon: -157.86 },
  { name: "Anchorage", region: "Alaska", country: "US", lat: 61.22, lon: -149.9 },
  { name: "Vancouver", region: "Columbia Britannica", country: "CA", lat: 49.28, lon: -123.12 },
  { name: "Los Angeles", region: "California", country: "US", lat: 34.05, lon: -118.24 },
  { name: "New York", region: "New York", country: "US", lat: 40.71, lon: -74.01 },
  { name: "Città del Messico", region: "Città del Messico", country: "MX", lat: 19.43, lon: -99.13 },
  { name: "Lima", region: "Lima", country: "PE", lat: -12.05, lon: -77.04 },
  { name: "Santiago", region: "Santiago", country: "CL", lat: -33.45, lon: -70.67 },
  { name: "Buenos Aires", region: "Buenos Aires", country: "AR", lat: -34.6, lon: -58.38 },
  { name: "Rio de Janeiro", region: "Rio de Janeiro", country: "BR", lat: -22.91, lon: -43.17 },
];

/** One of them, by chance. */
export function randomPlace(): PlaceRef {
  return RANDOM_PLACES[Math.floor(Math.random() * RANDOM_PLACES.length)];
}
