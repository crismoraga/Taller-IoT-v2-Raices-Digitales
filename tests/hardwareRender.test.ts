import { describe, expect, it } from "vitest";
import { circuits } from "../web/circuit/layouts";
import { circuitForBoard } from "../web/circuit/boards";
import { endpointXY } from "../web/circuit/geometry";
import {
  highlightedTerminals,
  inspectedTerminals,
  hardwareWireCurve,
} from "../web/experience/HardwareModels";

describe("physical terminal highlighting in the 3D inspector", () => {
  it("takes a short cable upwards out of a tall header instead of through its casing", () => {
    const a: [number, number, number] = [0, 0.49, 0];
    const b: [number, number, number] = [0.1, 0.15, 0.1];
    const points = hardwareWireCurve(a, b);
    expect(points[0]).toEqual(a);
    expect(points.at(-1)).toEqual(b);
    expect(points[1][1]).toBeGreaterThan(a[1]);
    expect(points[3][1]).toBeGreaterThan(b[1]);
    expect(points[2][1]).toBeGreaterThan(Math.max(a[1], b[1]));
    expect(
      Math.max(
        ...hardwareWireCurve(a, [20, 0.36, 10]).map((point) => point[1]),
      ),
    ).toBeLessThanOrEqual(1.05);
  });
  it("keeps LED polarity labels while highlighting its two real holes", () => {
    const led = circuits.led.parts.find((part) => part.id === "led")!;
    const labels = inspectedTerminals(led);
    expect(labels).toEqual(["anodo → d26", "catodo → d27"]);
    expect(highlightedTerminals(circuits.led, labels)).toEqual(["d26", "d27"]);
  });

  it("resolves external sensor terminals from the shared physical layout", () => {
    const sensor = circuits.soil.parts.find((part) => part.type === "soil")!;
    const labels = inspectedTerminals(sensor);
    const highlights = highlightedTerminals(circuits.soil, labels);
    expect(highlights).toHaveLength(3);
    for (const endpoint of highlights) {
      expect(() => endpointXY(circuits.soil, endpoint)).not.toThrow();
      expect(
        circuits.soil.wires.some(
          (wire) => wire.from === endpoint || wire.to === endpoint,
        ),
      ).toBe(true);
    }
  });

  it("highlights actual controller headers and rejects unknown terminals", () => {
    const uno = circuitForBoard(circuits.led, "uno");
    expect(
      highlightedTerminals(uno, [
        "controller.D2",
        "GND → controller.GND",
        "controller.GP2",
        "led.inexistente",
        "a64",
        "texto",
      ]),
    ).toEqual(["controller.D2", "controller.GND"]);
    expect(highlightedTerminals(circuits.led, ["controller.D2"])).toEqual([]);
    expect(highlightedTerminals(circuits.led)).toEqual([]);
  });
});
