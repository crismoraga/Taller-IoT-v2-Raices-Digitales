/** Missing readings stay missing: a connected board may not report every sensor. */
export interface LivingReadings {
  soil?: number;
  light?: number;
  led?: boolean;
  source: "hardware" | "simulation";
}

export function normalizedLivingReadings(readings: LivingReadings) {
  const percent = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : undefined;
  return {
    soil: percent(readings.soil),
    light: percent(readings.light),
    led: typeof readings.led === "boolean" ? readings.led : undefined,
    source: readings.source,
  };
}
