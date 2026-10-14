import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { circuits } from "../web/circuit/layouts";
import { circuitForBoard } from "../web/circuit/boards";
import { pointXY } from "../web/circuit/breadboard";
import {
  endpointXY,
  moduleBounds,
  moduleBox,
  modulePinXY,
  rainPlateBox,
} from "../web/circuit/geometry";
import { partDef } from "../web/circuit/parts";
import { ModuleShape } from "../web/circuit/ModuleShapes";
import { partSceneBounds } from "../web/experience/circuitFocus";
import { fittedCameraDistance } from "../web/experience/SceneSupport";
import { PerspectiveCamera, Vector3 } from "three";
import { analyze } from "../web/circuit/netlist";
import {
  circuitProgressSignature,
  configureDhtPinOrder,
  DHT_PIN_ORDERS,
  type DhtPinOrder,
} from "../web/lesson/assembly";

describe("sensor footprints and the actual 2.54 mm connector row", () => {
  it("keeps long probes recognisable and preserves the connector edge facing the breadboard", () => {
    const soil = circuits.soil.parts.find((part) => part.type === "soil")!;
    const water = circuits.water.parts.find((part) => part.type === "water")!;
    expect(moduleBox(soil).h / moduleBox(soil).w).toBeGreaterThan(4);
    expect(moduleBox(soil).h * 2.54).toBeCloseTo(98, 0);
    expect(moduleBox(water).h * 2.54).toBeCloseTo(63, 0);
    for (const part of [soil, water]) {
      const box = moduleBox(part);
      expect(box.y + box.h).toBeCloseTo(part.at!.y + 4.4);
      expect(box.y + box.h).toBeLessThan(-1.4);
    }
  });

  it("aligns each module pin to a centred physical header, independent of PCB width", () => {
    for (const part of circuits.station.parts.filter((part) => !part.holes)) {
      const box = moduleBox(part);
      const points = partDef(part).pins.map((pin) => modulePinXY(part, pin.id));
      points.forEach((point, index) => {
        expect(point.y).toBeCloseTo(box.y < 0 ? box.y + box.h : box.y);
        if (index) expect(point.x - points[index - 1].x).toBeCloseTo(1);
      });
      expect((points[0].x + points.at(-1)!.x) / 2).toBeCloseTo(
        box.x + box.w / 2,
      );
    }
  });

  it("does not overlap modules in the assembled station", () => {
    const parts = circuits.station.parts.filter((part) => !part.holes);
    for (let index = 0; index < parts.length; index++) {
      const a = moduleBounds(parts[index]);
      for (const other of parts.slice(index + 1)) {
        const b = moduleBounds(other);
        const x = Math.max(
          0,
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
        );
        const y = Math.max(
          0,
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
        );
        expect(x * y, `${parts[index].type} overlaps ${other.type}`).toBe(0);
      }
    }
  });

  it("frames both the separate FC-37 sensing plate and its LM393 comparator", () => {
    const rain = circuits.rain.parts.find((part) => part.type === "rain")!;
    const module = moduleBox(rain);
    const plate = rainPlateBox(rain);
    const bounds = moduleBounds(rain);
    expect(plate.x).toBeGreaterThan(module.x + module.w);
    expect(bounds.x + bounds.w).toBe(plate.x + plate.w);
    expect(bounds.y + bounds.h).toBe(plate.y + plate.h);
    const svg = renderToStaticMarkup(
      createElement(ModuleShape, { part: rain, unit: 24 }),
    );
    expect(svg).toContain("FC-37 · placa de gotas");
    expect(svg).toContain("LM393");
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("retains every inserted leg and board connector when visual footprints change", () => {
    for (const board of ["uno", "nano", "nano-old", "nano-168"] as const) {
      const circuit = circuitForBoard(circuits.station, board);
      for (const part of circuit.parts)
        for (const [pin, hole] of Object.entries(part.holes ?? {}))
          expect(endpointXY(circuit, `${part.id}.${pin}`)).toEqual(
            pointXY(hole),
          );
      for (const wire of circuit.wires)
        for (const endpoint of [wire.from, wire.to]) {
          const { x, y } = endpointXY(circuit, endpoint);
          expect([x, y].every(Number.isFinite)).toBe(true);
        }
    }
  });

  it("rejects unknown module pins rather than silently drawing a connector in the wrong place", () => {
    const soil = circuits.soil.parts.find((part) => part.type === "soil")!;
    expect(() => modulePinXY(soil, "DO")).toThrow("no tiene el pin DO");
  });
});

describe("close view of the selected real sensor", () => {
  it("frames every sensor body and connector at desktop and narrow aspect ratios", () => {
    for (const part of circuits.station.parts) {
      const bounds = partSceneBounds(part);
      const target = new Vector3(...bounds.min)
        .add(new Vector3(...bounds.max))
        .multiplyScalar(0.5);
      for (const aspect of [0.8, 1.5, 2.2]) {
        const outward = new Vector3(0.22, 1, 0.65).normalize();
        const distance = fittedCameraDistance(
          bounds,
          target,
          outward,
          40,
          aspect,
        );
        const camera = new PerspectiveCamera(40, aspect, 0.1, 100);
        camera.position.copy(target).add(outward.multiplyScalar(distance));
        camera.lookAt(target);
        camera.updateMatrixWorld();
        for (const x of [bounds.min[0], bounds.max[0]])
          for (const y of [bounds.min[1], bounds.max[1]])
            for (const z of [bounds.min[2], bounds.max[2]]) {
              const clip = new Vector3(x, y, z).project(camera);
              expect(Math.abs(clip.x)).toBeLessThan(1);
              expect(Math.abs(clip.y)).toBeLessThan(1);
            }
      }
    }
  });
  it("includes upright sensor height and the separate rain plate", () => {
    const dht = circuits.dht11.parts.find((part) => part.type === "dht11")!;
    expect(partSceneBounds(dht).max[1]).toBeGreaterThan(1.6);
    const rain = circuits.rain.parts.find((part) => part.type === "rain")!;
    const plate = rainPlateBox(rain);
    expect(partSceneBounds(rain).max[0]).toBeGreaterThan(
      (plate.x + plate.w - 33) * 0.13,
    );
  });
});

describe("DHT11: follow the real printed three-pin order", () => {
  it("retains the existing default circuit and progress identity", () => {
    expect(configureDhtPinOrder(circuits.dht11, "vcc-data-gnd")).toBe(
      circuits.dht11,
    );
    expect(configureDhtPinOrder(circuits.led, "data-vcc-gnd")).toBe(
      circuits.led,
    );
  });
  for (const board of [
    "pico",
    "uno",
    "nano",
    "nano-old",
    "nano-168",
  ] as const) {
    for (const order of Object.keys(DHT_PIN_ORDERS) as DhtPinOrder[]) {
      it(`${board}/${order}: preserves the netlist and every other component in both DHT and complete station`, () => {
        for (const source of [circuits.dht11, circuits.station]) {
          const original = circuitForBoard(source, board);
          const before = structuredClone(original);
          const adapted = configureDhtPinOrder(original, order);
          const sensor = adapted.parts.find((part) => part.type === "dht11")!;
          expect(original).toEqual(before);
          expect(adapted.nets).toBe(original.nets);
          expect(
            analyze(adapted, { splitRails: true, vbus: 5.25 }).issues.filter(
              (issue) => issue.level === "error",
            ),
          ).toEqual([]);
          expect(
            DHT_PIN_ORDERS[order].pins.map((pin) => sensor.holes![pin]),
          ).toEqual(["a44", "a45", "a46"]);
          expect(adapted.parts.filter((part) => part.type !== "dht11")).toEqual(
            original.parts.filter((part) => part.type !== "dht11"),
          );
          expect(
            adapted.wires.filter((wire) => !wire.id.startsWith("w_dht")),
          ).toEqual(
            original.wires.filter((wire) => !wire.id.startsWith("w_dht")),
          );
          if (order !== "vcc-data-gnd")
            expect(circuitProgressSignature(board, adapted)).not.toBe(
              circuitProgressSignature(board, original),
            );
        }
      });
    }
  }
});
