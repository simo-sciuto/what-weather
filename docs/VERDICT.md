# VERDICT

Status: proposal of the `weather-data` agent, 2026-10-20, for WTH-354 ("È un buon momento per andarci?"). Not built. Two things need the user's word first: the thresholds below (they are a proposal; CAI and SAC guidance support the principles, not the numbers) and a new data contract, `RouteWeather`, with its ADR (rule 5, ADR-005's list of always-Open-Meteo sources). Claims marked [verify] were not checkable here (no network) and belong in WTH-341.

## 1. How a verdict is made

- Pure functions: `routeOutlook(summary, weather, departure, now)` and `peakOutlook(peak, weather, instant, now)`.
- Walking time DIN 33466 (4 km/h flat, 300 m/h up, 500 m/h down; per leg the larger plus half the smaller). Each sample is read at the forecast hour nearest its arrival, within 30 minutes; otherwise it is "not evaluated".
- Departures every hour 05:00 to 14:00 on the local day, built from wall-clock hours (DST days stay right).
- Exposure: a route sample at its arrival hour; storms over that hour to one hour after the estimated end. A peak at `instant`; storms and precipitation over `instant` to `instant + 3 h`.
- Each factor is ok, riserva or no; a sample takes its worst factor; the outlook its worst sample. Ties: storm, snow, precipitation, wind, freezing level, daylight, cold, visibility, heat. At most four reasons.
- Never in the verdict: CAI or SAC difficulty, snowpack, avalanches, trail condition, closures (shown as facts or links: AINEVA, Météo-France BERA, SLF).

## 2. Thresholds (proposal)

| Factor | Variable | Ok | Con riserva | Non ora | Applies to |
| --- | --- | --- | --- | --- | --- |
| Storm | `weather_code` 95/96/99 | none in window | in the hour after the end | in any sample's window | all |
| Instability | `cape` with `precipitation_probability` | CAPE < 400 | 400 to 1000, or 1000+ with probability < 0.3 | 1000+ with probability 0.3+ | all |
| Precipitation | probability, amount, code | < 0.2 | 0.2 to 0.5, or a wet code below 0.5 | 0.5+ with a wet code, or 1+ mm/h | all |
| Snow | `snowfall` | 0 | | > 0.2 cm/h | all |
| Freezing level | `freezing_level_height` | eleMax + 300 or more | below eleMax + 300 | never alone | highest sample |
| Gusts | `wind_gusts_10m` | < 50 | 50 to 69 | 70+ | all |
| Free-air wind | `wind_speed_700hPa` | < 30 | 30 to 49 | 50+ | samples 2200 m+ |
| Cold | wind chill (JAG/TI) | > -15 | -15 to -24 | -25 or less | samples 1500 m+ |
| Daylight | sunset | end by sunset - 90 min | end by sunset - 30 | later | end of walk |
| Visibility | `cloud_cover_low`, `visibility`, fog | low cloud < 80, 1 km+ | low cloud 80+, < 1 km, fog | never alone | samples 2000 m+ |
| Heat | `apparent_temperature` | < 32 | 32+ | never | samples < 1500 m |

## 3. The four verdicts and certainty

- Non si può ancora dire: the walk ends more than 72 h ahead; the departure is past; a sample has no hour within 30 minutes; the weather code or both precipitation variables are missing; two or more critical variables are missing.
- Non ora: any factor "no". Con riserva: any factor "riserva", or a critical variable missing (never favourable). Buon momento: all ok and all critical variables present.
- Critical: weather code, precipitation, temperature, 10 m gust, freezing level, free-air wind at 2200 m+. Secondary (missing costs one step of certainty): CAPE, low cloud, visibility.
- Certainty by lead time to the end of the walk: up to 24 h alta, 24 to 48 h media, 48 to 72 h bassa and "indicativo", beyond 72 h no verdict. One step lower for a missing variable, CAPE 400+, a model run older than 12 h, a sample above 2500 m. Why 48 h: the convection-permitting models end around there [verify].

## 4. Data

Today's hourly request lacks `freezing_level_height`, `cape`, `cloud_cover_low`, `snowfall`, `wind_speed_700hPa` and its direction, hourly wind direction, `elevation=` per sample, a named model, the run time. Recommended: not extending `WeatherData` but a new `RouteWeather` type (`src/types/route.ts`) from a new always-Open-Meteo source (`src/lib/api/sources/route-weather.ts`, pure `parseRouteWeather`, a mock fixture), as `weather-field.ts` does; peaks reuse it with one sample. About 1.5 to 2 call units per sample [verify]. Open-Meteo's response `elevation` may be the downscaling height, not the grid's [verify].

## 5. Words (Italian)

- Storm: "Temporali possibili dalle {13} alle {16} lungo il percorso." / "Temporali possibili poco dopo il rientro, dalle {16}."
- Instability: "Aria instabile nel pomeriggio: possibili temporali isolati, il modello non sa dire dove."
- Rain: "Pioggia probabile ({70}%) mentre sei in quota, verso le {11}."
- Snow: "Neve prevista sopra i {2500} m verso le {10}."
- Freezing level: "Zero termico a {2800} m, sotto la vetta ({3538} m): possibile neve o ghiaccio in quota."
- Wind: "Vento in quota sui {55} km/h verso le {12}, stimato in quota." / "Raffiche fino a {70} km/h, dal modello a quota più bassa: in cresta possono essere più forti."
- Cold: "In vetta circa {-4}°, col vento sembrano {-14}° (calcolato)."
- Visibility: "Nubi basse in quota dalle {13}: il sentiero può essere difficile da seguire."
- Daylight: "Rientro dopo il tramonto ({18:12}): meglio partire entro le {9}."
- Missing: "{Lo zero termico} non è disponibile per questo percorso: non valutato." / "Temporali valutati solo dal tipo di tempo previsto: l'instabilità dell'aria non c'è."
- Horizon: "Non si può ancora dire. Oltre 3 giorni le previsioni in montagna non bastano per decidere: riguarda da {giovedì}." / "Indicativo: mancano più di 2 giorni." / "Questa partenza è già passata."
- Certainty: "Certezza: alta. Mancano meno di 24 ore." / "Certezza: bassa. Aria instabile: dove nascono i temporali non si sa prima."
- Never "misurato", never "sicuro". Always: "Non sostituisce il bollettino di ARPA Piemonte né le notizie sul sentiero."

## 6. Tests to write first

27 cases from the agent's report, among them: a calm day is Buon momento alta; a storm code at the summit's hour is Non ora; a storm three hours after the end is Buon momento; freezing level below summit plus 300 is Con riserva; free-air wind 55 km/h only below 2200 m is ignored; the worst sample wins and is named; a missing freezing level is Con riserva with lower certainty and never hides a bad factor; missing weather code is Non si può ancora dire; 56 h ahead is indicativo, 73 h has no verdict; DIN 33466 on a 10 km leg with 1000 m up is about 4.58 h; on 2026-10-25 in Europe/Rome the ten departures land on the right Unix times; no output string contains "sicuro".
