import { describe, expect, it } from "vitest";
import { circuitForBoard } from "../web/circuit/boards";
import { clearanceProblems } from "../web/circuit/geometry";
import { circuits } from "../web/circuit/layouts";
import { analyze } from "../web/circuit/netlist";
import {
  configureDhtPinOrder,
  DHT_PIN_ORDERS,
  normalizeCircuitSteps,
  type DhtPinOrder,
} from "../web/lesson/assembly";

describe("the guided plant station", () => {
  for (const board of ["pico", "uno", "nano", "nano-old", "nano-168"] as const)
    for (const order of Object.keys(DHT_PIN_ORDERS) as DhtPinOrder[])
      it(`${board}/${order}: only the learned LED, light, climate and soil components form the exact netlist`, () => {
        const station = normalizeCircuitSteps(
          configureDhtPinOrder(
            circuitForBoard(circuits.station_basic, board),
            order,
          ),
        );
        expect(station.parts.map((part) => part.id).sort()).toEqual([
          "dht",
          "ldr",
          "led",
          "r_ldr",
          "r_led",
          "soil",
        ]);
        expect(
          station.parts
            .filter((part) => part.type === "resistor")
            .map((part) => part.props?.ohms)
            .sort((a, b) => Number(a) - Number(b)),
        ).toEqual([220, 10000]);
        expect(
          analyze(station, { splitRails: true, vbus: 5.25 }).issues.filter(
            (issue) => issue.level === "error",
          ),
        ).toEqual([]);
        expect(clearanceProblems(station)).toEqual([]);

        // A learner keeps the real holes and wires assembled in each preceding activity.
        for (const lesson of ["led", "ldr", "dht11", "soil"] as const) {
          const previous = configureDhtPinOrder(
            circuitForBoard(circuits[lesson], board),
            order,
          );
          for (const part of previous.parts)
            expect(
              station.parts.find((candidate) => candidate.id === part.id),
            ).toEqual(part);
          for (const wire of previous.wires)
            expect(
              station.wires.find((candidate) => candidate.id === wire.id),
            ).toEqual(wire);
        }

        const terminals = station.nets.flat();
        const pins =
          board === "pico"
            ? ["pico:GP2", "pico:GP27", "pico:GP15", "pico:GP26"]
            : [
                "controller:D2",
                "controller:A1",
                "controller:D4",
                "controller:A0",
              ];
        for (const pin of pins) expect(terminals).toContain(pin);
        expect(terminals).not.toContain("pico:VBUS");
        const result = analyze(station);
        expect(result.netOf("dht.VCC")).toBe(
          result.netOf(board === "pico" ? "pico:3V3" : "controller:5V"),
        );
        if (board !== "pico")
          expect(result.netOf("dht.VCC")).not.toBe(result.netOf("soil.VCC"));
        expect(
          station.wires
            .map((wire) => wire.id)
            .filter((id) => id.startsWith("w_bridge_")),
        ).toEqual(
          board === "pico" ? ["w_bridge_bp", "w_bridge_bn"] : ["w_bridge_bn"],
        );
        const actions = station.steps.flatMap((step) => [
          ...(step.parts ?? []),
          ...(step.wires ?? []),
        ]);
        expect(actions).toHaveLength(
          station.parts.length + station.wires.length,
        );
        expect(new Set(actions).size).toBe(actions.length);
        expect(
          station.steps.every(
            (step) =>
              (step.parts?.length ?? 0) + (step.wires?.length ?? 0) <= 1,
          ),
        ).toBe(true);
      });

  it("keeps the complete optional kit under its existing station key", () => {
    expect(circuits.station.id).toBe("station");
    expect(circuits.station.parts.map((part) => part.type)).toEqual(
      expect.arrayContaining([
        "buzzer",
        "ds18b20",
        "water",
        "rain",
        "hcsr04",
        "pir",
      ]),
    );
    expect(
      circuits.station_basic.parts.every((part) =>
        ["led", "resistor", "ldr", "dht11", "soil"].includes(part.type),
      ),
    ).toBe(true);
  });
});

describe("DHT11 supply matches the selected board", () => {
  for (const board of ["pico", "uno", "nano", "nano-old", "nano-168"] as const)
    for (const order of Object.keys(DHT_PIN_ORDERS) as DhtPinOrder[])
      it(`${board}/${order}: a standalone, basic and expanded station preserve every DHT pin and supply`, () => {
        for (const source of [
          circuits.dht11,
          circuits.station_basic,
          circuits.station,
        ]) {
          const circuit = configureDhtPinOrder(
            circuitForBoard(source, board),
            order,
          );
          const result = analyze(circuit, { splitRails: true, vbus: 5.25 });
          expect(
            result.issues.filter((issue) => issue.level === "error"),
          ).toEqual([]);
          expect(result.netOf("dht.VCC")).toBe(
            result.netOf(board === "pico" ? "pico:3V3" : "controller:5V"),
          );
          expect(result.netOf("dht.DATA")).toBe(
            result.netOf(board === "pico" ? "pico:GP15" : "controller:D4"),
          );
          expect(result.netOf("dht.GND")).toBe(
            result.netOf(board === "pico" ? "pico:GND" : "controller:GND"),
          );
          if (board !== "pico") {
            expect(result.netOf("dht.VCC")).not.toBe(
              result.netOf("controller:3V3"),
            );
            const power = circuit.wires.find((wire) => wire.id === "w_dht_3v3");
            expect(power).toMatchObject({
              color: "naranja",
              carries: "5 V",
              to: source.id === "station" ? "g1" : "controller.5V",
            });
            expect(
              circuit.steps.find((step) => step.wires?.includes("w_dht_3v3"))
                ?.title,
            ).toContain("naranja");
            expect(
              circuit.wires
                .flatMap((wire) => [wire.from, wire.to])
                .filter((end) => end === "controller.5V"),
            ).toHaveLength(1);
          }
          if (source.id !== "dht11") {
            expect(result.netOf("soil.VCC")).toBe(
              result.netOf(board === "pico" ? "pico:3V3" : "controller:3V3"),
            );
            expect(result.netOf("ldr.a")).toBe(result.netOf("soil.VCC"));
          }
          if (source.id === "station") {
            expect(result.netOf("hc.VCC")).toBe(
              result.netOf(board === "pico" ? "pico:VBUS" : "controller:5V"),
            );
            expect(result.netOf("pir.VCC")).toBe(result.netOf("hc.VCC"));
            for (const terminal of ["water.VCC", "rain.VCC", "ds.VDD"])
              expect(result.netOf(terminal)).toBe(result.netOf("soil.VCC"));
          }
        }
      });
});
