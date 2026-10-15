import type { Reading } from "./api";

export type ReadingSource = "hardware" | "simulation";
export const LIVE_READING_WINDOW_MS = 20_000;

export function readingTime(reading: Reading): number {
  const timestamp = Date.parse(reading.timestamp || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function readingSource(reading: Reading): ReadingSource {
  return reading.source === "simulation" ? "simulation" : "hardware";
}

function isRecentReceipt(reading: Reading, now: number) {
  const elapsed = now - readingTime(reading);
  return (
    readingTime(reading) > 0 &&
    elapsed >= -5_000 &&
    elapsed < LIVE_READING_WINDOW_MS
  );
}

export function isLiveReading(reading: Reading | undefined, now = Date.now()) {
  if (!reading || ["DISABLED", "NO_RESPONSE", "ERROR"].includes(reading.status))
    return false;
  return isRecentReceipt(reading, now);
}

export function hasReadingValue(
  reading: Reading | undefined,
): reading is Reading & { value: number } {
  return (
    !!reading &&
    ["READING", "OUT_OF_RANGE", "UNVERIFIED"].includes(reading.status) &&
    typeof reading.value === "number" &&
    Number.isFinite(reading.value)
  );
}

/** Keep each view on one source so a simulated value never fills a physical sensor's gap. */
export function dashboardReadings(
  readings: Reading[],
  selected: string,
  now = Date.now(),
): { source: ReadingSource; latest: Map<string, Reading> } {
  const latestBySource = {
    hardware: new Map<string, Reading>(),
    simulation: new Map<string, Reading>(),
  };
  for (const reading of readings) {
    const sourceReadings = latestBySource[readingSource(reading)];
    const previous = sourceReadings.get(reading.sensor);
    if (!previous || readingTime(reading) >= readingTime(previous))
      sourceReadings.set(reading.sensor, reading);
  }
  let source: ReadingSource;
  if (selected === "hardware" || selected === "simulation") source = selected;
  else if (
    [...latestBySource.hardware.values()].some(
      (reading) =>
        reading.status !== "DISABLED" && isRecentReceipt(reading, now),
    )
  )
    source = "hardware";
  else {
    const newest = [
      ...latestBySource.hardware.values(),
      ...latestBySource.simulation.values(),
    ]
      .filter(
        (reading) => reading.status !== "DISABLED" && readingTime(reading) > 0,
      )
      .reduce<Reading | undefined>(
        (previous, reading) =>
          !previous || readingTime(reading) >= readingTime(previous)
            ? reading
            : previous,
        undefined,
      );
    source = newest ? readingSource(newest) : "hardware";
  }
  return { source, latest: latestBySource[source] };
}
