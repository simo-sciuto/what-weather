import type { VisualForce } from "./atmosphere";
import type { WeatherVisualInput } from "./visual-input";

/**
 * Scenario fixtures for calibrating the Weather Visual Engine (WTH-046K),
 * shared by the tests and the atmosphere lab. Each is a set of plausible
 * measurements, never a city preset: the archetypes are named after a kind
 * of place only to say what weather they stand for, and nothing anywhere
 * reads that name. `expected` is what the scenario should look like and which
 * forces should lead it; the lab shows where the engine disagrees.
 */
export interface CalibrationScenario {
  readonly id: string;
  /** Italian, as the lab shows it */
  readonly label: string;
  /** Measurements in project units, including the Frame.light phase */
  readonly input: WeatherVisualInput & { readonly light: number };
  readonly expected: {
    readonly dominant: VisualForce | null;
    readonly secondary: VisualForce | null;
    /** The visual behaviour wanted, in Italian, as the lab shows it */
    readonly look: string;
  };
}

export const CALIBRATION_SCENARIOS: readonly CalibrationScenario[] = [
  {
    id: "clear-summer-noon",
    label: "Mezzogiorno d'estate, sereno",
    input: { light: 0.5, temp: 29, cloudCover: 5, humidity: 40, visibility: 30, dewPoint: 14, precipitation: 0, uvIndex: 8.5, condition: "clear" },
    expected: { dominant: "sun", secondary: "heat", look: "Cielo pieno e profondo, gradiente netto, bagliore forte. Calore appena accennato." },
  },
  {
    id: "winter-dawn",
    label: "Alba d'inverno",
    input: { light: 0.03, temp: -4, cloudCover: 10, humidity: 85, visibility: 12, dewPoint: -6, precipitation: 0, uvIndex: 0.2, condition: "clear" },
    expected: { dominant: "cold", secondary: "sun", look: "L'alba resta riconoscibile, più lilla e fredda all'orizzonte, senza velo (12 km di visibilità)." },
  },
  {
    id: "dense-fog",
    label: "Nebbia fitta",
    input: { light: 0.3, temp: 6, cloudCover: 95, humidity: 99, visibility: 0.2, dewPoint: 5.8, precipitation: 0, uvIndex: 1, condition: "fog" },
    expected: { dominant: "haze", secondary: "cloud", look: "Le fermate del cielo si avvicinano in un velo chiaro e quasi grigio. Profondità compressa, non un grigio scuro." },
  },
  {
    id: "light-rain",
    label: "Pioggia debole",
    input: { light: 0.4, temp: 14, cloudCover: 85, humidity: 88, visibility: 10, dewPoint: 12, precipitation: 0.8, uvIndex: 1.5, condition: "rain", intensity: "light" },
    expected: { dominant: "cloud", secondary: "rain", look: "Coperto e un po' più scuro, ardesia leggera, ancora del colore del giorno." },
  },
  {
    id: "heavy-rain",
    label: "Pioggia forte",
    input: { light: 0.55, temp: 17, cloudCover: 100, humidity: 96, visibility: 4, dewPoint: 16, precipitation: 9, uvIndex: 0.5, condition: "rain", intensity: "heavy" },
    expected: { dominant: "rain", secondary: "haze", look: "Più scuro, denso, ardesia, con la profondità che si chiude (4 km di visibilità). Più bagnato della pioggia debole, mai più chiaro." },
  },
  {
    id: "thunderstorm",
    label: "Temporale",
    input: { light: 0.7, temp: 24, cloudCover: 95, humidity: 78, visibility: 6, dewPoint: 20, precipitation: 15, uvIndex: 0.5, condition: "thunderstorm", intensity: "heavy" },
    expected: { dominant: "storm", secondary: "rain", look: "La scena più profonda: cima del cielo scura contro un orizzonte più chiaro, bagliore quasi spento." },
  },
  {
    id: "snow",
    label: "Neve",
    input: { light: 0.4, temp: -2, cloudCover: 100, humidity: 92, visibility: 2.5, dewPoint: -3, precipitation: 1.5, uvIndex: 0.5, condition: "snow", intensity: "moderate" },
    expected: { dominant: "snow", secondary: "cloud", look: "Più chiaro, quieto e freddo della pioggia alla stessa intensità. Mai una pioggia fredda." },
  },
  {
    id: "snowy-dusk",
    label: "Neve al tramonto",
    input: { light: 1.02, temp: -1, cloudCover: 100, humidity: 93, visibility: 3, dewPoint: -2, precipitation: 1, uvIndex: 0, condition: "snow", intensity: "light" },
    expected: { dominant: "snow", secondary: "cloud", look: "Il tramonto si spegne in un bianco freddo appena azzurro: mai lilla o magenta." },
  },
  {
    id: "clear-sunset",
    label: "Tramonto sereno",
    input: { light: 0.98, temp: 20, cloudCover: 10, humidity: 55, visibility: 25, dewPoint: 10, precipitation: 0, uvIndex: 0.3, condition: "clear" },
    expected: { dominant: "sun", secondary: "heat", look: "Il tramonto della base solare, quasi intatto: rosa e corallo all'orizzonte." },
  },
  {
    id: "overcast-night",
    label: "Notte coperta",
    input: { light: 2, temp: 9, cloudCover: 100, humidity: 80, visibility: 15, dewPoint: 6, precipitation: 0, uvIndex: 0, condition: "cloudy" },
    expected: { dominant: "cloud", secondary: "cold", look: "Notte senza stelle: blu inchiostro spento, gradiente quasi piatto." },
  },
  {
    id: "dry-heat",
    label: "Caldo secco",
    input: { light: 0.6, temp: 39, cloudCover: 0, humidity: 15, visibility: 20, dewPoint: 5, precipitation: 0, uvIndex: 9, condition: "clear" },
    expected: { dominant: "sun", secondary: "heat", look: "Ancora un cielo sereno, non un tema arancione: blu appena più caldo, bagliore pieno." },
  },
  {
    id: "humid-fog-plain",
    label: "Pianura umida e nebbiosa",
    input: { light: 0.12, temp: 4, cloudCover: 70, humidity: 98, visibility: 0.8, dewPoint: 3.7, precipitation: 0, uvIndex: 0.3, condition: "fog" },
    expected: { dominant: "haze", secondary: "cold", look: "Mattino lattiginoso: il sole basso si perde in un velo, profondità compressa." },
  },
  {
    id: "mediterranean-sun",
    label: "Sole mediterraneo",
    input: { light: 0.45, temp: 33, cloudCover: 0, humidity: 45, visibility: 35, dewPoint: 19, precipitation: 0, uvIndex: 10, condition: "clear" },
    expected: { dominant: "sun", secondary: "heat", look: "Il cielo più vivo della serie, gradiente pieno, nessun velo." },
  },
  {
    id: "maritime-rain",
    label: "Pioggia di mare",
    input: { light: 0.35, temp: 11, cloudCover: 100, humidity: 93, visibility: 8, dewPoint: 10, precipitation: 2.5, uvIndex: 1, condition: "rain", intensity: "moderate" },
    expected: { dominant: "cloud", secondary: "rain", look: "Grigio ardesia fresco e uniforme, umido ma non temporalesco." },
  },
  {
    id: "northern-snow",
    label: "Neve del nord",
    input: { light: 0.15, temp: -12, cloudCover: 60, humidity: 85, visibility: 6, dewPoint: -14, precipitation: 0.6, uvIndex: 0.5, condition: "snow", intensity: "light" },
    expected: { dominant: "cold", secondary: "snow", look: "Sole basso e luce bianca, freddo, chiaro, poco colore." },
  },
  {
    id: "subtropical-night",
    label: "Notte subtropicale umida",
    input: { light: 2, temp: 28, cloudCover: 40, humidity: 90, visibility: 9, dewPoint: 26, precipitation: 0, uvIndex: 0, condition: "partly-cloudy" },
    expected: { dominant: "heat", secondary: "cloud", look: "Notte calda e umida, senza velo (9 km di visibilità): inchiostro più viola, gradiente morbido." },
  },
];
