# Weather Visual Engine

Current checkpoint: WTH-046A/B/C/D implemented. Provider atmospheric measurements now reach samples, frames and client-derived FrameLook atmosphere. The rendered palette remains unchanged until later calibrated integration.

## WTH-046A: normalized atmosphere and visual grammar

The first implementation checkpoint added `src/lib/weather/atmosphere.ts`, a pure internal model and deterministic signature resolver. That checkpoint did not consume weather measurements or change the rendered product; WTH-046B/C below add normalization and transport. `WeatherState`, `SkyPalette`, map tuning and poster rendering retain their current visual behaviour. The existing palette remains the only colour engine.

`createAtmosphere(axes)` accepts already normalized, finite `AtmosphereAxes` and returns an immutable `AtmosphereState` with derived clarity and signature. Missing, nonfinite or out-of-range internal axes throw `RangeError`; these are programming errors at this boundary, not a policy for missing provider data. WTH-046B/C must resolve unavailable measurements upstream using documented deterministic fallbacks, preserving provenance instead of claiming defaults are observations. Do not pass raw `WeatherData` directly to this function.

| Axis | Range | Meaning and ownership |
| --- | --- | --- |
| daylight | 0..1 | Available natural solar light before weather attenuation. Separate from `Frame.light`, the existing -1..2 solar phase coordinate. Solar hue/time progression remains in the palette. |
| warmth | -1..1 | Cold to hot, neutral at zero. Temperature controls restrained phase-dependent warmth, never an absolute orange/blue theme. |
| cloudiness | 0..1 | Cloud influence on chroma, global contrast and glow. An overcast sky can still have clear air below it. |
| haze | 0..1 | Optical loss of depth derived later from visibility, dew proximity and humidity together. |
| clarity | 0..1 | Derived as `1 - haze`; cannot be supplied as an independent competing control. This is optical depth, not the absence of clouds. |
| wetness | 0..1 | Liquid precipitation influence on density and luminance; not total precipitation including snow. |
| severity | 0..1 | Storm-like visual intensity and local hierarchy; independent of wetness. Not a meteorological warning or hazard classification. No wind/gust contribution to colour in V1. |
| snow | 0..1 | Separate brighter, quieter, cooler force; can coexist with wetness for mixed precipitation. |
| energy | 0..daylight | Daylight-gated UV influence on chroma/glow; distinct from warmth. Zero at night. |

## Signature and conflicts

The signature describes the two strongest positive visual forces. Its ranking is a summary for explanation and later metadata, not a switch for choosing categorical palettes. Future colour/depth composition uses the continuous axes, bounded influences and explicit composition rules in WTH-046E/F/G. A change in the winning force must not cause a palette jump.

| Force | Strength |
| --- | --- |
| sun | `daylight * (1 - cloudiness) * clarity` |
| heat | `max(0, warmth)` |
| cold | `max(0, -warmth)` |
| cloud | `cloudiness` |
| haze | `haze` |
| rain | `wetness` |
| snow | `snow` |
| storm | `severity` |

Rank strength descending. Only exact ties use this explicit order: storm, snow, rain, haze, cloud, cold, heat, sun. This favors specific disruptive phenomena over background conditions at equal strength; a weak storm force does not override stronger haze. Heat and cold cannot both be positive. There are no random choices, city presets, hidden thresholds or dependence on object property order.

`signature.dominant` and `signature.secondary` are distinct `VisualForce` values or `null`: an absent force must not be invented. A neutral, clear night can have neither; a clear mild day can have sun alone. This deliberately refines the board's illustrative non-null shape. The solar base still describes a clear night even when there is no dominant weather force. Energy remains an axis rather than another score for sun; UV should not reorder the explanatory signature independently of the atmosphere.

Examples use normalized axes, not raw cloud percentages or meteorological fixtures:

- cloudiness 0.9 + haze 1: haze dominant, cloud secondary.
- cloudiness 0.9 + severity 1 + wetness 0.7: storm dominant, cloud secondary.
- snow 0.8 + wetness 0.8: snow dominant, rain secondary.
- haze 0.9 + severity 0.2, other axes zero: haze dominant, storm secondary.
- daylight 0, warmth 0, other axes zero: both null; no false sun or rain.

`WeatherState` remains the current semantic source for condition interpretation, glyphs, narrative and exceptional phenomena. Its current palette use is preserved until the calibrated transform is integrated; this checkpoint does not claim that migration is complete.

## Next checkpoint and validation

WTH-046B defines measurement curves, fallbacks and a provider-agnostic visual input feeding these axes. WTH-046C carries required measurements through the timeline. Scores and tie precedence are initial documented grammar, to be revisited through WTH-046K scenario calibration before visual integration. WTH-046M remains PARKED; wind/motion is not part of this V1 contract.

The colocated unit tests cover conflicting phenomena, tie precedence, absence of invented forces, mixed rain/snow, reproducibility, immutable output, clarity/depth monotonicity, solar energy constraints and invalid internal input. They validate the model, not final colours, accessibility or full meteorological scenario calibration, which remain later checkpoints.

## WTH-046B: weather input normalization

`src/lib/weather/visual-input.ts` now defines `WeatherVisualInput` and `computeAtmosphere(input)`. It consumes measurements in project units and returns `{ atmosphere, inputStatus }`; `atmosphere` is the validated state from WTH-046A. No provider payload, city, current clock, wind or `WeatherState` is read. WTH-046C below connects the module to frames; palette rendering still uses the existing engine.

The numeric input fields are optional/nullable: `light` (existing -1..2 phase), `temp` and `dewPoint` (degrees C), `cloudCover` and `humidity` (%), `visibility` (km), `precipitation` (combined mm/h), and `uvIndex`. Optional `condition`/`intensity` use the existing project types for semantic exceptions and missing-data fallback. Do not pass metres, rain probability, feels-like temperature or an hourly accumulation of a different duration as these measurements.

Each numeric input receives a status: `supplied`, `clamped`, `missing` (null/undefined), or `invalid` (nonfinite/non-numeric). Invalid inputs follow the same fallback as missing inputs. Finite percentages are clamped to 0..100; phase to -1..2; visibility, precipitation and UV to nonnegative values. Temperature and dew point retain their finite values; the curves bound their influence. Curve saturation is not input clamping. `supplied` explicitly does not mean observed: provenance already lost in an adapter cannot be recovered here. WTH-046C must preserve missingness and measured/estimated provenance at the data boundary. The result and its status map are frozen.

`S(a,b,x)` below is clamped smoothstep, with `t = clamp01((x-a)/(b-a))` and `S = t*t*(3-2*t)`. These are initial visual calibration choices, not scientific estimates of atmospheric state.

| Axis | Curve and maximum influence | Missing/invalid input policy |
| --- | --- | --- |
| daylight | Existing solar gate: zero for phase <=0 or >=1; otherwise `clamp01(2*sin(pi*light))`, bounded 0..1. Preserve the distinction between phase and brightness. | 0; absence of solar timing cannot invent daylight. Polar handling stays upstream in frame generation. |
| warmth | Segment-wise smoothstep through (-15,-1), (-5,-0.8), (5,-0.5), (12,-0.25), (18,0), (24,0.25), (30,0.6), (36,0.9), (42,1); saturate outside the endpoints. Monotone, continuous, zero derivative at anchors. | Neutral 0; do not substitute feels-like temperature or a city's typical climate. |
| cloudiness | `S(0,100,cloudCover)`, bounded 0..1. Measured cover wins over semantic category. | Reuse `TYPICAL_CLOUD_COVER[condition]`; no condition means neutral influence 0. This is a labelled fallback, not an observation of clear sky. |
| haze | `0.55*visibilityLoss + 0.30*dewProximity + 0.15*humidityFactor`, clamped 0..1. `visibilityLoss = 1-S(1.5,20,visibility)`; `dewProximity = 1-S(0,8,temp-dewPoint)`; `humidityFactor = S(0.45,0.98,humidity/100)`. Dew points above temperature saturate proximity, without extrapolation. | Missing components contribute zero, without rescaling available weights. Missing visibility with condition fog uses visibilityLoss=1; otherwise 0. Missing either temperature or dew point removes that whole contribution. Humidity alone contributes at most 0.15. |
| clarity | `1-haze`, bounded 0..1, derived by WTH-046A. | Follows haze. High clarity with missing data is a neutral visual fallback, not a claim of measured visibility. |
| wetness | Liquid-phase rate uses `clamp01(log1p(rate)/log1p(12))`, bounded 0..1. It saturates at 12 mm/h and responds more strongly to the first millimetre. | For rain/thunderstorm: rates 0.5/2/8 mm/h for light/moderate/heavy; drizzle: 0.2/0.5/1. Other conditions: 0. Missing intensity uses moderate. Measured zero wins over these defaults. |
| snow | With snow condition, the same bounded precipitation curve is applied to the combined rate, while wetness is zero. Other conditions give zero snow. | Snow condition with unavailable precipitation uses influence 0.3/0.6/0.9 for light/moderate/heavy; missing intensity uses moderate. Measured zero still wins. |
| severity | Rain contribution `0.6*S(2,12,liquidRate)`, independent from wetness. Thunderstorm contributes 0.75/0.9/1 for light/moderate/heavy (moderate if absent). Combine by maximum, never addition; bounded 0..1. | Rain rate fallback as above. An explicit thunderstorm can retain severity without measured rain. Snow does not contribute liquid-rain severity. No wind/gust input, directly or indirectly. |
| energy | `daylight*S(0,8,uvIndex)`, bounded 0..daylight. More UV cannot heat the warmth axis. | Neutral mid-curve UV reference 4 gives `0.5*daylight`; it is not a measured UV value. Measured UV zero remains zero. Later transforms must preserve neutral missing-UV behaviour when adapting the current vividness system. |

Fallbacks apply only where the contributing measurement is unavailable; condition must not override a valid measurement. For example, rain + measured 0 mm/h stays dry, but thunderstorm can still carry severity; fog + supplied 20 km visibility does not receive the missing-visibility fallback. The condition remains available upstream for narrative and icons.

### Precipitation phase limitation

The current OpenWeather transformers sum rain and snow; the normalized model also groups freezing rain under `snow`. No separate quantitative liquid/snow fraction survives. WTH-046B uses that existing semantic condition: snow assigns the total to the snow axis, other/unknown conditions assign it to liquid precipitation. This is a deterministic interpretation of the current contract, not measured phase separation. Do not double-count the total into both axes or infer snow from temperature alone. Mixed precipitation remains expressible in the WTH-046A model but cannot be quantitatively reconstructed from this input; a future data-contract extension would be needed. Provider changes are outside this checkpoint.

### Validation and remaining work

Focused tests cover every temperature anchor, continuity and monotonicity, visibility/dew-point depth relationships, the humid-clear/low-visibility examples, logarithmic wetness, severity independence, rain/snow separation, UV/daylight gating, fallback precedence, statuses, invalid values, determinism and immutable output. These are numerical model checks, not the WTH-046K visual calibration suite. No claim about final map hierarchy, palette contrast or exported appearance is made yet.

WTH-046C below implements transport through adapters, hourly samples and frames, retaining units and provenance and addressing synthetic daily overviews. The integration must explicitly map `Frame.uv` to `uvIndex` and use the returned `atmosphere`; the new module must not be fed defaulted observations as if their provenance were known. Final visual integration remains after calibration; motion remains PARKED.

## WTH-046C: atmospheric timeline transport

The path now runs through the existing provider adapters -> `CurrentWeather` / `HourlyPoint` -> `Sample` -> `Frame` -> `frameLook()` -> `computeAtmosphere()`. FrameLook exposes `atmosphere` and `atmosphereInputStatus` alongside the existing `palette` and `sky`. No generated atmospheric state or colours are added to the serialized frame payload; they are computed for the selected frame as before (ADR-007). The future WeatherVisualPalette and its rendered integration remain later checkpoints.

### Measurement availability and origin

`AtmosphericMeasurements` adds optional humidity (%), visibility (km) and dewPoint (degrees C), plus per-field `atmosphericSources`. Values are finite; humidity outside 0..100, negative visibility and nonfinite values become unavailable rather than invented observations. Zero remains valid for all three. Origin is `provider`, `estimated`, `mock`, `unknown` or `unavailable`. `provider` includes supplied forecasts/model output, not just station observations. Legacy/custom values without origin are `unknown`, never silently labelled provider observations.

Origin and temporal sampling are distinct: `Frame.measured` means an original provider timestamp, not proof every field was observed. A free-tier dew-point estimate remains `estimated` even on a measured frame. For interpolated frames, `measured` is false; the origin still identifies supplied, estimated or mock endpoint data. Estimated origin takes precedence when either endpoint was estimated; otherwise mock, then provider if both were provider, else unknown. Missing values always have unavailable origin.

For compatibility, the existing current-weather detail UI retains required numeric fields and its legacy fallback values (such as OpenWeather's 10 km visibility default). Adapters mark such placeholders unavailable. `atmosphericData()` strips them before timeline/visual use. This checkpoint does not claim to fix how the existing detail UI displays missing current data. The new optional hourly fields never invent those defaults. `atmosphereInputStatus` describes normalization handling; it does not replace the frame's original source information.

### Provider coverage

| Provider | Current and hourly behaviour |
| --- | --- |
| OpenWeather One Call | Map humidity/dew point and convert visibility metres to km. Missing visibility is unavailable, not a visual 10 km observation. The existing One Call request already contains these fields; mapping lives in `transformers.ts`. |
| OpenWeather free | Map humidity and visibility from both current and three-hour forecast points. Prefer supplied dew point; otherwise use the existing Magnus approximation with valid temperature/humidity and label it estimated. Humidity zero/invalid cannot generate a finite dew estimate. No current value is copied to every forecast hour. |
| Open-Meteo | Request `relative_humidity_2m`, `dew_point_2m` and `visibility` hourly as well as current. Convert visibility to km; null or absent new arrays/cells remain unavailable. These variables and units are documented in the [official forecast API](https://open-meteo.com/en/docs). |
| Mock | Populate the hourly measurements from the deterministic scenario profile; dew point follows that hour's temperature. Current and hourly origin is mock, never observational. |

The engine still consumes normalized project data only. Raw provider shapes and unit conversion stay in adapters; no new endpoint, dependency or client credential was introduced. Wind/gust transport for a future motion layer is not part of this checkpoint.

### Interpolation and synthetic days

For humidity, visibility and dew point, interpolate linearly only between two available endpoints. Preserve an exact endpoint independently of the other endpoint's availability. If either endpoint is missing, intermediate hours stay missing; do not forward-fill today's atmosphere into an unknown forecast. The original point/interpolated flag is retained. Frames round humidity/dew point to two decimals and visibility to three decimals (km), matching the existing compact numeric payload approach.

Daily overview frames now have `overview: true` and `measured: false`. Their maximum temperature, peak UV, representative cloud cover and placeholder zero precipitation are not same-hour measurements. New atmospheric normalization receives the overview's semantic condition/intensity and its existing representative solar coordinate, but omits those synthetic quantitative values and all three unavailable atmospheric measurements. Thus a rainy daily overview can use the documented rain fallback rather than become dry because of a placeholder zero. Its light is representative, not a claim of a measured moment; its warmth is neutral because no hourly temperature exists. Existing daily palette inputs are preserved to avoid introducing visual changes before calibration.

### Verification and next checkpoint

Provider fixtures and timeline tests cover units, nulls, supplied zero, unavailable legacy defaults, estimated dew point, exact endpoints, three-hour interpolation, missing endpoint behaviour, selected-hour atmosphere, JSON transport and daily overviews. A direct equality check protects the existing selected frame palette. Narrative, activities and best-window regression suites are also exercised. Network payloads are simulated; no live provider-account validation or final visual calibration is claimed.

WTH-046D below formalizes the existing solar base without changing its time-of-day progression. Map/UI/poster integration follows calibration; WTH-046M remains PARKED.

## WTH-046D: solar base palette

`palette.ts` now exposes `solarPalette(light): SolarPalette`, the former private `clearSky(light)`. The existing anchor table is named `SOLAR_STOPS`. The function stays inside the current palette engine; no parallel colour system or extra rendering layer is introduced.

The input is the finite `Frame.light` solar phase coordinate: -1 is the pre-dawn night endpoint, 0 sunrise, 1 sunset and 2 the following night endpoint. Values outside that range clamp to the respective endpoints. This is a time coordinate relative to sunrise/sunset, not solar elevation or normalized daylight intensity. The existing 90-minute twilight mapping and polar fallback in `frames.ts` remain unchanged: without usable sun times, night maps to -1 and daytime to 0.45.

The output is an intermediate natural-light base: `sky` contains top/middle/horizon RGB triples, with interpolated sRGB channels in 0..255; `glow` contains RGB plus alpha in 0..1. Calls return fresh arrays. Weather conditions, temperature, cloud cover, visibility, humidity, precipitation and UV do not enter this function. Its raw colours have not yet passed text/glass contrast protection and must not be used directly as the final UI palette.

| Existing phase anchor | Role in the visual progression |
| --- | --- |
| -1 | Night: ink-blue sky and periwinkle glow. |
| -0.4 | Pre-dawn blue hour, leading into dawn. |
| 0 | Sunrise: rose/apricot horizon. |
| 0.07 | Early morning warmth. |
| 0.2 | Morning, cooler open sky. |
| 0.45 | Existing midday artistic anchor; not an astronomical solar-noon calculation. |
| 0.72 | Afternoon, slightly deeper sky. |
| 0.9 | Evening golden hour. |
| 1 | Sunset: rose/coral horizon. |
| 1.4 | Evening blue hour. |
| 2 | Night, matching the first endpoint. |

Every anchor value and the existing piecewise linear interpolation are preserved exactly. Morning and evening retain their asymmetry; there are no new phase thresholds or city presets. The 0..1 `AtmosphereState.daylight` axis remains separate and cannot replace the phase argument: reducing a full day to brightness would lose dawn/sunset hue information.

`skyPalette()` consumes this base, then applies the existing weather modifiers, daylight-gated UV behaviour, text/glass contrast protection and map-ink generation. That downstream computation is unchanged. A comparison of the TypeScript-transpiled implementation against the prior file, allowing only the intended names/export, confirms identical executable calculations. Existing palette and atmospheric pipeline suites provide regression coverage; no duplicate colour fixtures or new implementation-mirroring tests were added for this refactor.

Next: WTH-046E, develop bounded OKLCH atmosphere transforms over this shared solar base. The successful solar progression remains the foundation; final UI/map/poster integration still follows scenario calibration.
