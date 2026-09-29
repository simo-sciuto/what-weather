/**
 * Region names in Italian. OpenWeather's geocoding gives regions ("state")
 * only in English; this covers Italy's twenty regions under the spellings it
 * uses, and a few regions abroad that Italians usually name in Italian.
 * Anything else is shown as it comes.
 */
const REGIONS: Record<string, string> = {
  // Italy
  Abruzzo: "Abruzzo",
  "Aosta Valley": "Valle d’Aosta",
  "Aosta Valley Region": "Valle d’Aosta",
  "Aoste Valley": "Valle d’Aosta",
  Apulia: "Puglia",
  Basilicata: "Basilicata",
  Calabria: "Calabria",
  Campania: "Campania",
  "Emilia-Romagna": "Emilia-Romagna",
  "Friuli Venezia Giulia": "Friuli-Venezia Giulia",
  "Friuli-Venezia Giulia": "Friuli-Venezia Giulia",
  Lazio: "Lazio",
  Latium: "Lazio",
  Liguria: "Liguria",
  Lombardy: "Lombardia",
  Marche: "Marche",
  Molise: "Molise",
  Piedmont: "Piemonte",
  Sardinia: "Sardegna",
  Sicily: "Sicilia",
  "Trentino-South Tyrol": "Trentino-Alto Adige",

  Tuscany: "Toscana",
  Umbria: "Umbria",
  Veneto: "Veneto",
  // Abroad
  Andalusia: "Andalusia",
  Bavaria: "Baviera",
  Catalonia: "Catalogna",
  England: "Inghilterra",
  Scotland: "Scozia",
  Wales: "Galles",
  "Northern Ireland": "Irlanda del Nord",
  "Lower Saxony": "Bassa Sassonia",
  "North Rhine-Westphalia": "Renania Settentrionale-Vestfalia",
  Saxony: "Sassonia",
  Tyrol: "Tirolo",
  "Canton of Ticino": "Canton Ticino",
  Ticino: "Canton Ticino",
  "Canton of Geneva": "Canton Ginevra",
  "Canton of Zurich": "Canton Zurigo",
  Brittany: "Bretagna",
  Normandy: "Normandia",
  "Balearic Islands": "Isole Baleari",
  "Canary Islands": "Isole Canarie",
  Crete: "Creta",
  California: "California",
  "New York": "New York",
};

export function regionName(region: string | undefined): string | undefined {
  if (!region) return region;
  return REGIONS[region] ?? region;
}
