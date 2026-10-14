import { describe, expect, it } from "vitest";
import {
  usbBridgeReadings,
  usbFrame,
  usbReading,
} from "../web/lib/usb-readings";

const soil = {
  sensor: "soil",
  value: null,
  unit: "%",
  status: "NEEDS_CALIBRATION",
  raw: 567,
};

describe("USB telemetry boundary", () => {
  it("preserves real null, raw, UTF-8 and receipt data without manufacturing a value", () => {
    const sample = { ...soil, confidence: "medición", error: "Raíces 🌱" };
    expect(usbReading(sample)).toEqual(sample);
    expect(usbBridgeReadings(usbFrame(sample)!.readings)).toEqual([sample]);
  });

  it.each([null, [], "READING", 5, { error: "prueba" }])(
    "does not render a malformed status %j as a React child",
    (status) => {
      const frame = usbFrame({ readings: [{ ...soil, status }, soil] });
      expect(frame?.readings).toEqual([soil]);
      expect(usbBridgeReadings(frame!.readings)).toEqual([soil]);
    },
  );

  it.each([
    { value: "567" },
    { value: {} },
    { value: [] },
    { value: Infinity },
    { unit: {} },
    { raw: "567" },
    { raw: null },
    { error: {} },
    { confidence: [] },
    { sensor: "" },
  ])("rejects malformed fields without coercion: %j", (override) => {
    expect(usbReading({ ...soil, ...override })).toBeUndefined();
  });

  it("keeps the last valid row for a sensor and does not let an invalid row erase it", () => {
    const newest = { ...soil, raw: 600 };
    const frame = usbFrame({
      readings: [soil, newest, { ...soil, value: { nested: true } }],
    });
    expect(frame?.readings).toEqual([newest]);
    expect(usbBridgeReadings(frame!.readings)).toEqual([newest]);
  });

  it("keeps custom scalar statuses and sensors locally while excluding incompatible HTTP rows", () => {
    const custom = { ...soil, sensor: "mi_sensor", status: "INICIANDO" };
    const connected = { ...soil, status: "CONNECTED" };
    const wrongUnit = { ...soil, unit: "lux" };
    const frame = usbFrame({ readings: [custom, connected, wrongUnit] });
    expect(frame?.readings).toEqual([custom, wrongUnit]);
    expect(usbReading(connected)).toEqual(connected);
    expect(usbBridgeReadings([custom, connected, wrongUnit, soil])).toEqual([
      soil,
    ]);
  });

  it("preserves scalar diagnostics and prevents nested values from invalidating good rows", () => {
    const frame = usbFrame({
      readings: [null, [], soil],
      diagnostics: {
        ip: "192.168.1.2",
        net: "ONLINE",
        tlsVerified: true,
        uptime: 2000,
        cloudError: null,
        nested: { bad: true },
        array: [],
        invalidNumber: Infinity,
      },
    });
    expect(frame).toEqual({
      readings: [soil],
      diagnostics: {
        ip: "192.168.1.2",
        net: "ONLINE",
        tlsVerified: true,
        uptime: 2000,
        cloudError: null,
      },
    });
    expect(usbBridgeReadings(frame!.readings)).toEqual([soil]);
    expect(usbFrame({ diagnostics: { uptime: 2 } })).toEqual({
      readings: [],
      diagnostics: { uptime: 2 },
    });
  });

  it("rejects non-object frames and missing values while keeping explicit null", () => {
    expect(usbFrame(null)).toBeUndefined();
    expect(usbFrame([soil])).toBeUndefined();
    expect(usbFrame("soil")).toBeUndefined();
    expect(
      usbReading({ sensor: "soil", unit: "%", status: "NO_RESPONSE" }),
    ).toBeUndefined();
    expect(usbReading({ ...soil, status: "NO_RESPONSE" })).toEqual({
      ...soil,
      status: "NO_RESPONSE",
    });
  });
});
