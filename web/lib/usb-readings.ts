import { readingSchema, sensorUnits } from "../../shared/telemetry";
import type { Reading } from "./api";

type Diagnostics = Record<string, string | number | boolean | null>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Keep actual USB samples as received; a JSON object is not necessarily a reading. */
export function usbReading(value: unknown): Reading | undefined {
  if (
    !record(value) ||
    !text(value.sensor, 100) ||
    !value.sensor.trim() ||
    !(value.value === null || finite(value.value)) ||
    !text(value.unit, 32) ||
    (Object.hasOwn(sensorUnits, value.sensor) &&
      value.unit !== sensorUnits[value.sensor]) ||
    !text(value.status, 100) ||
    !value.status.trim() ||
    (value.raw !== undefined && !finite(value.raw)) ||
    (value.confidence !== undefined && !text(value.confidence, 100)) ||
    (value.error !== undefined && !text(value.error, 500))
  )
    return undefined;
  return {
    sensor: value.sensor,
    value: value.value,
    unit: value.unit,
    status: value.status,
    ...(value.raw !== undefined ? { raw: value.raw } : {}),
    ...(value.confidence !== undefined ? { confidence: value.confidence } : {}),
    ...(value.error !== undefined ? { error: value.error } : {}),
  };
}

/** Each row stands alone: one malformed sample must not discard the other sensors. */
export function usbFrame(value: unknown):
  | {
      readings: Reading[];
      diagnostics?: Diagnostics;
    }
  | undefined {
  if (!record(value)) return undefined;
  const candidates = Array.isArray(value.readings) ? value.readings : [value];
  const readings = new Map<string, Reading>();
  for (const candidate of candidates.slice(0, 32)) {
    const reading = usbReading(candidate);
    if (reading) readings.set(reading.sensor, reading);
  }
  const diagnostics: Diagnostics = {};
  if (record(value.diagnostics))
    for (const [key, item] of Object.entries(value.diagnostics)) {
      if (
        key.length <= 64 &&
        (item === null ||
          typeof item === "boolean" ||
          finite(item) ||
          text(item, 1000))
      )
        diagnostics[key] = item;
    }
  return {
    readings: [...readings.values()],
    ...(record(value.diagnostics) ? { diagnostics } : {}),
  };
}

/** The HTTP bridge uses its actual schema; custom prints remain visible locally. */
export function usbBridgeReadings(readings: Reading[]): Reading[] {
  return readings.flatMap((reading) => {
    const parsed = readingSchema.safeParse(reading);
    return parsed.success ? [parsed.data] : [];
  });
}
