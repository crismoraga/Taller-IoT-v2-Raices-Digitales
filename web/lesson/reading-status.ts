import type { Reading } from "../lib/api";

export type ReadingTone = "valid" | "pending" | "error" | "neutral";

/** A received message is not necessarily a valid sensor measurement. */
export function readingTone(
  reading: Pick<Reading, "status" | "value">,
): ReadingTone {
  if (reading.status === "READING") {
    return typeof reading.value === "number" && Number.isFinite(reading.value)
      ? "valid"
      : "error";
  }
  if (["ERROR", "NO_RESPONSE", "OUT_OF_RANGE"].includes(reading.status))
    return "error";
  if (["NEEDS_CALIBRATION", "UNVERIFIED"].includes(reading.status))
    return "pending";
  return "neutral";
}
