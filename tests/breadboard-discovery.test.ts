import { describe, expect, it } from "vitest";
import { circuits } from "../web/circuit/layouts";
import { circuitForBoard } from "../web/circuit/boards";
import {
  assessDiscoveryChoice,
  discoveryConnectedHoles,
  discoveryPinRoles,
  discoverySignalPath,
} from "../web/lesson/breadboardDiscovery";

describe("el primer ejercicio enseña la conectividad física del montaje", () => {
  it("ilumina solamente los cinco agujeros del mismo lado y número", () => {
    expect(discoveryConnectedHoles("a26")).toEqual([
      "a26",
      "b26",
      "c26",
      "d26",
      "e26",
    ]);
    expect(discoveryConnectedHoles("f26")).toEqual([
      "f26",
      "g26",
      "h26",
      "i26",
      "j26",
    ]);
    expect(assessDiscoveryChoice("groups", "b26", "uno").correct).toBe(true);
    expect(assessDiscoveryChoice("groups", "b27", "uno").correct).toBe(false);
    expect(assessDiscoveryChoice("groups", "a26", "uno").correct).toBe(false);
    expect(assessDiscoveryChoice("gap", "a26", "uno").correct).toBe(true);
    expect(assessDiscoveryChoice("gap", "f26", "uno").correct).toBe(false);
  });

  it("nunca da continuidad por defecto entre mitades, colores o rieles opuestos", () => {
    expect(discoveryConnectedHoles("tn:30")).toContain("tn:31");
    for (const point of ["tn:33", "tp:30", "bn:30"]) {
      expect(discoveryConnectedHoles("tn:30")).not.toContain(point);
      expect(assessDiscoveryChoice("rails", point, "uno").correct).toBe(false);
    }
    expect(assessDiscoveryChoice("rails", "tn:31", "uno").correct).toBe(true);
    // The physical 830-point model has no rail hole opposite 32.
    expect(discoveryConnectedHoles("tn:32")).toEqual([]);
  });

  for (const board of [
    "uno",
    "nano",
    "nano-old",
    "nano-168",
    "pico",
  ] as const) {
    it(`${board}: el ejemplo continúa exactamente por el jumper del próximo LED`, () => {
      const signal = discoverySignalPath(board);
      const actualLed = circuitForBoard(circuits.led, board);
      expect(signal.to).toBe("a22");
      expect(actualLed.wires).toContainEqual(
        expect.objectContaining({
          id: "w_led_sig",
          from: signal.from,
          to: signal.to,
          color: signal.color,
        }),
      );
      const resistanceInput = actualLed.parts.find(
        (part) => part.id === "r_led",
      )?.holes?.a;
      expect(resistanceInput).toBe("c22");
      expect(discoveryConnectedHoles(signal.to)).toContain(resistanceInput);
      expect(
        assessDiscoveryChoice("path", resistanceInput!, board).correct,
      ).toBe(true);
      expect(assessDiscoveryChoice("path", "f22", board).correct).toBe(false);
      expect(assessDiscoveryChoice("path", "a23", board).correct).toBe(false);
      expect(assessDiscoveryChoice("pins", signal.pin, board).correct).toBe(
        true,
      );
      for (const pin of discoveryPinRoles(board)
        .map((candidate) => candidate.pin)
        .filter((pin) => pin !== signal.pin)) {
        expect(assessDiscoveryChoice("pins", pin, board).correct).toBe(false);
      }
      expect(discoveryPinRoles(board).map((pin) => pin.pin)).toContain(
        board === "pico" ? "VBUS" : "5V",
      );
    });
  }
});
