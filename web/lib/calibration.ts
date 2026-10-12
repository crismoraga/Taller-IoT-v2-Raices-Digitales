import type { Reading } from "./api";
import type { Board } from "./context";
import { isBoard } from "../../shared/boards";

export type Calibration = { dry: number; wet: number; board?: Board };

/** References belong to an ADC family; changing boards never rescales real samples. */
export function compatibleCalibration(
  calibration: Calibration | undefined,
  board: Board,
): calibration is Calibration {
  if (!calibration) return false;
  const pico = board === "pico";
  const { dry, wet } = calibration;
  const max = pico ? 65535 : 1023;
  if (
    !Number.isInteger(dry) ||
    !Number.isInteger(wet) ||
    dry < 0 ||
    wet < 0 ||
    dry > max ||
    wet > max ||
    Math.abs(dry - wet) < (pico ? 500 : 8)
  )
    return false;
  if (calibration.board !== undefined) {
    if (!isBoard(calibration.board))
      return false;
    return (calibration.board === "pico") === pico;
  }
  // An untagged pair in the overlapping range could come from either ADC.
  // Preserve it in the backup, but require two references on the selected board.
  // Values above 1023 can only belong to Pico among the supported controllers.
  return pico && Math.max(dry, wet) > 1023;
}

export function filterCalibrations(
  calibrations: Record<string, Calibration>,
  board: Board,
): Record<string, Calibration> {
  return Object.fromEntries(
    Object.entries(calibrations).filter(([, value]) =>
      compatibleCalibration(value, board),
    ),
  );
}

const RAW_STATUSES = new Set([
  "READING",
  "CONNECTED",
  "NEEDS_CALIBRATION",
  "UNVERIFIED",
  "OUT_OF_RANGE",
]);

/** A disconnected, stale or failed sample must not appear to be a live USB reference. */
export function latestHardwareRaw(
  readings: Reading[],
  sensor: string,
  board: Board,
  connected: boolean,
  now = Date.now(),
): Reading | undefined {
  if (!connected) return undefined;
  const latest = readings
    .filter(
      (reading) => reading.sensor === sensor && reading.source === "hardware",
    )
    .sort(
      (a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""),
    )[0];
  if (!latest) return undefined;
  const timestamp = Date.parse(latest.timestamp || "");
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > 20000 ||
    timestamp - now > 1000 ||
    !RAW_STATUSES.has(latest.status) ||
    !Number.isInteger(latest.raw) ||
    latest.raw! < 0 ||
    latest.raw! > (board === "pico" ? 65535 : 1023)
  )
    return undefined;
  return latest;
}
