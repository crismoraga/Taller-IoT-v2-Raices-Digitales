import { describe, expect, it } from "vitest";
import {
  dashboardReadings,
  hasReadingValue,
  isLiveReading,
} from "../web/lib/dashboard-readings";
import type { Reading } from "../web/lib/api";

const now = Date.parse("2026-10-15T12:00:00Z");
const sample = (overrides: Partial<Reading> = {}): Reading => ({
  sensor: "soil",
  value: 55,
  unit: "%",
  status: "READING",
  source: "hardware",
  timestamp: new Date(now - 1_000).toISOString(),
  ...overrides,
});

describe("live plant dashboard", () => {
  it("keeps the station on physical data when the simulator sends a newer unrelated sample", () => {
    const hardware = sample();
    const simulated = sample({
      sensor: "light",
      source: "simulation",
      timestamp: new Date(now).toISOString(),
    });
    const result = dashboardReadings([hardware, simulated], "all", now);
    expect(result.source).toBe("hardware");
    expect([...result.latest.keys()]).toEqual(["soil"]);
  });

  it("shows simulation explicitly when physical data has stopped, and never fills it with old hardware", () => {
    const oldHardware = sample({
      timestamp: new Date(now - 60_000).toISOString(),
    });
    const simulated = sample({ sensor: "light", source: "simulation" });
    const result = dashboardReadings([oldHardware, simulated], "all", now);
    expect(result.source).toBe("simulation");
    expect([...result.latest.keys()]).toEqual(["light"]);
    expect(
      dashboardReadings([oldHardware, simulated], "hardware", now).latest.get(
        "soil",
      ),
    ).toBe(oldHardware);
  });

  it.each(["ERROR", "NO_RESPONSE"])(
    "keeps a fresh physical %s visible instead of hiding it behind simulation",
    (status) => {
      const failed = sample({ status, value: null });
      const simulated = sample({
        source: "simulation",
        timestamp: new Date(now).toISOString(),
      });
      const result = dashboardReadings([failed, simulated], "all", now);
      expect(result.source).toBe("hardware");
      expect(result.latest.get("soil")).toBe(failed);
      expect(isLiveReading(failed, now)).toBe(false);
    },
  );

  it("preserves qualified digital values without turning them into verified measurements", () => {
    const motion = sample({
      sensor: "motion",
      value: 0,
      unit: "0/1",
      status: "UNVERIFIED",
    });
    expect(hasReadingValue(motion)).toBe(true);
    expect(
      dashboardReadings([motion], "hardware", now).latest.get("motion")?.status,
    ).toBe("UNVERIFIED");
  });

  it("lets the newest status replace an old value including disabled sensors", () => {
    const old = sample({ timestamp: new Date(now - 5_000).toISOString() });
    const disabled = sample({ value: null, status: "DISABLED" });
    expect(
      dashboardReadings([old, disabled], "hardware", now).latest.get("soil"),
    ).toBe(disabled);
    expect(hasReadingValue(disabled)).toBe(false);
    expect(isLiveReading(disabled, now)).toBe(false);
  });

  it("does not revive a disabled physical sensor from an older duplicate when choosing a source", () => {
    const previous = sample({ timestamp: new Date(now - 5_000).toISOString() });
    const disabled = sample({ value: null, status: "DISABLED" });
    const simulated = sample({ source: "simulation" });
    expect(
      dashboardReadings([previous, disabled, simulated], "all", now).source,
    ).toBe("simulation");
  });

  it.each([
    "ERROR",
    "NO_RESPONSE",
    "DISABLED",
    "NEEDS_CALIBRATION",
    "CONNECTED",
  ])("does not turn %s into a numerical plant measurement", (status) => {
    expect(hasReadingValue(sample({ status }))).toBe(false);
  });

  it("does not paint stale or invalid timestamps as live", () => {
    expect(isLiveReading(sample(), now)).toBe(true);
    expect(
      isLiveReading(
        sample({ timestamp: new Date(now - 20_000).toISOString() }),
        now,
      ),
    ).toBe(false);
    expect(isLiveReading(sample({ timestamp: "invalid" }), now)).toBe(false);
    expect(
      isLiveReading(
        sample({ timestamp: new Date(now + 60_000).toISOString() }),
        now,
      ),
    ).toBe(false);
  });

  it("excludes malformed and non-finite values without coercing them", () => {
    expect(hasReadingValue(sample({ value: NaN }))).toBe(false);
    expect(hasReadingValue(sample({ value: Infinity }))).toBe(false);
    expect(hasReadingValue(sample({ value: null }))).toBe(false);
    expect(hasReadingValue(sample({ value: 0 }))).toBe(true);
  });

  it("resolves equal timestamps to the newest received local sample", () => {
    const server = sample({ value: 55 });
    const usb = sample({ value: 56 });
    expect(
      dashboardReadings([server, usb], "hardware", now).latest.get("soil")
        ?.value,
    ).toBe(56);
  });
});
