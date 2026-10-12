import { describe, expect, it } from "vitest";
import type { Reading } from "../web/lib/api";
import {
  compatibleCalibration,
  filterCalibrations,
  latestHardwareRaw,
  type Calibration,
} from "../web/lib/calibration";
import { arduinoStationSketch } from "../web/lib/arduino";
import { parseIntelHex } from "../web/lib/serial";

describe("physical reference provenance across boards", () => {
  it("does not assign an ambiguous backup to either ADC family", () => {
    const legacy = { dry: 100, wet: 800 };
    expect(compatibleCalibration(legacy, "pico")).toBe(false);
    for (const board of ["uno", "nano", "nano-old", "nano-168"] as const)
      expect(compatibleCalibration(legacy, board)).toBe(false);
    const explicit: Calibration = { ...legacy, board: "pico" };
    expect(compatibleCalibration(explicit, "pico")).toBe(true);
    expect(compatibleCalibration(explicit, "uno")).toBe(false);
    expect(arduinoStationSketch({ soil: legacy })).toContain(
      "const int SOIL_DRY = -1;",
    );
  });

  it("shares the AVR ADC family between Uno and both classic Nano bootloaders", () => {
    const fromUno: Calibration = { dry: 800, wet: 100, board: "uno" };
    for (const board of ["uno", "nano", "nano-old", "nano-168"] as const)
      expect(compatibleCalibration(fromUno, board)).toBe(true);
    expect(compatibleCalibration(fromUno, "pico")).toBe(false);
    expect(compatibleCalibration({ dry: 53000, wet: 16000 }, "pico")).toBe(
      true,
    );
  });

  it("filters only the installation payload, preserving stored references unchanged", () => {
    const saved: Record<string, Calibration> = {
      soil: { dry: 900, wet: 250, board: "nano" },
      water_level: { dry: 5000, wet: 45000, board: "pico" },
    };
    const original = structuredClone(saved);
    expect(filterCalibrations(saved, "pico")).toEqual({
      water_level: saved.water_level,
    });
    expect(filterCalibrations(saved, "nano-old")).toEqual({ soil: saved.soil });
    expect(saved).toEqual(original);
  });

  it("honors provenance during AVR code generation even when Pico numbers fit 10 bits", () => {
    const sketch = arduinoStationSketch({
      soil: { dry: 100, wet: 800, board: "pico" },
      water_level: { dry: 900, wet: 100, board: "nano-old" },
    });
    expect(sketch).toContain("const int SOIL_DRY = -1;");
    expect(sketch).toContain("const int SOIL_WET = -1;");
    expect(sketch).toContain("const int WATER_DRY = 900;");
    expect(sketch).toContain("const int WATER_WET = 100;");
  });

  it("rejects fractional, out-of-range and degenerate references for either ADC", () => {
    expect(compatibleCalibration({ dry: 65536, wet: 20000 }, "pico")).toBe(
      false,
    );
    expect(compatibleCalibration({ dry: 65500.5, wet: 20000 }, "pico")).toBe(
      false,
    );
    expect(compatibleCalibration({ dry: 20000, wet: 20100 }, "pico")).toBe(
      false,
    );
    expect(
      compatibleCalibration({ dry: 1024, wet: 10, board: "uno" }, "uno"),
    ).toBe(false);
    expect(compatibleCalibration({ dry: 100, wet: 103 }, "uno")).toBe(false);
  });
});

describe("a calibration capture uses the current physical USB sample", () => {
  const now = Date.parse("2026-10-12T01:00:00.000Z");
  const reading = (patch: Partial<Reading> = {}): Reading => ({
    sensor: "soil",
    value: null,
    unit: "%",
    status: "NEEDS_CALIBRATION",
    raw: 700,
    source: "hardware",
    timestamp: new Date(now - 1000).toISOString(),
    ...patch,
  });

  it("captures uncalibrated real voltage without claiming to detect sensor presence", () => {
    const actual = reading();
    expect(latestHardwareRaw([actual], "soil", "uno", true, now)).toBe(actual);
    const unverified = reading({ status: "UNVERIFIED", raw: 0 });
    expect(latestHardwareRaw([unverified], "soil", "uno", true, now)).toBe(
      unverified,
    );
  });

  it("rejects offline, stale, future and simulation samples", () => {
    expect(
      latestHardwareRaw([reading()], "soil", "uno", false, now),
    ).toBeUndefined();
    for (const sample of [
      reading({ timestamp: new Date(now - 20001).toISOString() }),
      reading({ timestamp: new Date(now + 1001).toISOString() }),
      reading({ timestamp: "not a timestamp" }),
      reading({ source: "simulation" }),
    ])
      expect(
        latestHardwareRaw([sample], "soil", "uno", true, now),
      ).toBeUndefined();
  });

  it("does not fall back to an earlier good RAW after the sensor reports an error", () => {
    const rows = [
      reading(),
      reading({ status: "ERROR", timestamp: new Date(now).toISOString() }),
    ];
    expect(latestHardwareRaw(rows, "soil", "uno", true, now)).toBeUndefined();
  });

  it("rejects a different sensor, invalid status or RAW from another ADC family", () => {
    for (const sample of [
      reading({ sensor: "light" }),
      reading({ status: "NO_RESPONSE" }),
      reading({ status: "DISABLED" }),
      reading({ status: "surprise" }),
      reading({ raw: 50000 }),
      reading({ raw: 700.5 }),
      reading({ raw: -1 }),
    ])
      expect(
        latestHardwareRaw([sample], "soil", "uno", true, now),
      ).toBeUndefined();
  });
});

describe("the actual AVR upload image has valid Intel HEX control records", () => {
  it("rejects a nonzero EOF address instead of accepting malformed compiler output", () => {
    expect(() => parseIntelHex(":0100000001FE\n:00000101FE")).toThrow(
      "Registro",
    );
  });
});
