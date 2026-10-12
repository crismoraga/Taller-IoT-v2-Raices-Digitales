import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { circuits } from "../web/circuit/layouts";
import { circuitForBoard } from "../web/circuit/boards";
import { endpointXY } from "../web/circuit/geometry";
import {
  highlightedTerminals,
  inspectedTerminals,
  hardwareWireCurve,
  terminalConnector,
  ledFlangeGeometry,
  ledDomeGeometry,
  LED_POLARITY,
} from "../web/experience/HardwareModels";
import { fittedCameraDistance } from "../web/experience/SceneSupport";

describe("physical terminal highlighting in the 3D inspector", () => {
  it("uses plugs that fit the actual breadboard and each controller header", () => {
    expect(terminalConnector(circuits.led, "a3")).toBe("macho");
    expect(terminalConnector(circuits.soil, "soil.VCC")).toBe("integrado");
    expect(terminalConnector(circuits.ds18b20, "ds.DATA")).toBe("integrado");
    for (const board of ["uno", "nano", "nano-old"] as const) {
      const circuit = circuitForBoard(circuits.led, board);
      expect(terminalConnector(circuit, "controller.D2")).toBe(
        board === "uno" ? "macho" : "hembra",
      );
      expect(terminalConnector(circuit, "bn:3")).toBe("macho");
    }
  });

  it("gives the LED rim a flat cathode edge without reversing the round anode side", () => {
    const flange = ledFlangeGeometry();
    flange.computeBoundingBox();
    expect(flange.boundingBox!.max.x).toBeLessThan(-flange.boundingBox!.min.x);
    expect(flange.boundingBox!.max.y).toBeCloseTo(-flange.boundingBox!.min.y);
    expect(flange.boundingBox!.max.z).toBeCloseTo(-flange.boundingBox!.min.z);
    flange.dispose();
  });

  it("keeps the longer anode lead opposite the cathode flat in both scenes", () => {
    const flange = ledFlangeGeometry();
    flange.computeBoundingBox();
    expect(LED_POLARITY.cathode.x).toBeGreaterThan(0);
    expect(LED_POLARITY.anode.x).toBeLessThan(0);
    expect(LED_POLARITY.anode.leadLength).toBeGreaterThan(
      LED_POLARITY.cathode.leadLength,
    );
    expect(flange.boundingBox!.max.x).toBeLessThan(-flange.boundingBox!.min.x);
    flange.dispose();
  });

  it("closes a continuous LED barrel and dome inside the same physical envelope", () => {
    const dome = ledDomeGeometry();
    dome.computeBoundingBox();
    expect(dome.boundingBox!.min.x).toBeCloseTo(-0.125);
    expect(dome.boundingBox!.max.x).toBeCloseTo(0.125);
    expect(dome.boundingBox!.min.y).toBeCloseTo(0.012);
    expect(dome.boundingBox!.max.y).toBeCloseTo(0.327);
    expect([...dome.attributes.normal.array].every(Number.isFinite)).toBe(true);
    dome.dispose();
  });

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

  it("does not bend a lead below a terminal taller than the usual wire arc", () => {
    const points = hardwareWireCurve([0, 1.3, 0], [1, 0.25, 0]);
    expect(points[1][1]).toBeGreaterThan(1.3);
    expect(points[2][1]).toBeGreaterThan(1.3);
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

describe("physical scene framing", () => {
  it.each([0.5, 1, 2.2])(
    "fits every corner in a perfectly vertical top view at aspect %s",
    (aspect) => {
      const bounds = { min: [-5, 0, -2], max: [5, 0.8, 2] } as const;
      const target = new Vector3(0, 0.4, 0);
      const outward = new Vector3(0, 1, 0);
      const distance = fittedCameraDistance(
        { min: [...bounds.min], max: [...bounds.max] },
        target,
        outward,
        40,
        aspect,
      );
      const camera = new PerspectiveCamera(40, aspect, 0.1, 100);
      camera.up.set(0, 0, -1);
      camera.position.copy(target).add(outward.multiplyScalar(distance));
      camera.lookAt(target);
      camera.updateMatrixWorld();
      for (const x of [bounds.min[0], bounds.max[0]])
        for (const y of [bounds.min[1], bounds.max[1]])
          for (const z of [bounds.min[2], bounds.max[2]]) {
            const screen = new Vector3(x, y, z).project(camera);
            expect(Math.abs(screen.x)).toBeLessThan(1);
            expect(Math.abs(screen.y)).toBeLessThan(1);
          }
    },
  );
});
