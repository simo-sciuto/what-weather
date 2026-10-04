import type { AtmosphericField, AtmosphericMeasurements, AtmosphericSource } from "./types";

const FIELDS: readonly AtmosphericField[] = ["humidity", "visibility", "dewPoint"];
type Input = { [K in AtmosphericField]?: number | null } & Pick<AtmosphericMeasurements, "atmosphericSources">;

/** Validate normalized units and strip unavailable legacy UI fallback numbers. */
export function atmosphericData(input: Input, origin: AtmosphericSource = "unknown"): AtmosphericMeasurements {
  const result: AtmosphericMeasurements = { atmosphericSources: {} };
  for (const key of FIELDS) {
    const value = input[key];
    const source = input.atmosphericSources?.[key] ?? origin;
    const valid = typeof value === "number" && Number.isFinite(value)
      && (key !== "humidity" || (value >= 0 && value <= 100))
      && (key !== "visibility" || value >= 0) && source !== "unavailable";
    if (valid) result[key] = value;
    result.atmosphericSources![key] = valid ? source : "unavailable";
  }
  return result;
}

/** Exact endpoints win, even when the other endpoint is missing. No carry-forward. */
export function interpolateAtmosphericData(a: AtmosphericMeasurements, b: AtmosphericMeasurements, fraction: number): AtmosphericMeasurements {
  if (fraction === 0) return atmosphericData(a);
  if (fraction === 1) return atmosphericData(b);
  const left = atmosphericData(a);
  const right = atmosphericData(b);
  const result: AtmosphericMeasurements = { atmosphericSources: {} };
  for (const key of FIELDS) {
    const x = left[key];
    const y = right[key];
    if (x == null || y == null) continue;
    result[key] = x * (1 - fraction) + y * fraction;
    const sources = [left.atmosphericSources![key], right.atmosphericSources![key]];
    result.atmosphericSources![key] = sources.includes("estimated") ? "estimated"
      : sources.includes("mock") ? "mock" : sources.every(s => s === "provider") ? "provider" : "unknown";
  }
  return atmosphericData(result);
}

/** Keep the existing Magnus estimate, but only with physically usable inputs. */
export function estimatedDewPoint(temp: number, humidity: number): number | undefined {
  if (!Number.isFinite(temp) || !Number.isFinite(humidity) || humidity <= 0 || humidity > 100 || temp <= -243.12) return undefined;
  const alpha = Math.log(humidity / 100) + (17.62 * temp) / (243.12 + temp);
  const result = (243.12 * alpha) / (17.62 - alpha);
  return Number.isFinite(result) ? result : undefined;
}
