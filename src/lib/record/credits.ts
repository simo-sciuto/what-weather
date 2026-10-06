import type { WeatherProvider } from "@/lib/api/providers/provider";

/**
 * The credit a record owes the source of its weather figures (WTH-212, docs/LICENCES.md): Open-Meteo's licence
 * (CC BY 4.0) asks for a credit next to wherever its data is shown, OpenWeather's asks for a visible one. Sample
 * data (`mock`) is nobody's, so it gets none.
 */
export function weatherCredit(provider: WeatherProvider["name"]): string | undefined {
  if (provider === "open-meteo") return "WEATHER DATA OPEN-METEO.COM";
  if (provider === "openweather" || provider === "openweather-free") return "WEATHER DATA OPENWEATHER";
  return undefined;
}
