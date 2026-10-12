import { describe, expect, it } from "vitest";
import {
  livingBoardProfile,
  normalizedLivingReadings,
} from "../web/experience/living-state";

describe("the selected controller in the living station", () => {
  it("switches USB identity, dimensions and signal attachment together", () => {
    const pico = livingBoardProfile("pico");
    const uno = livingBoardProfile("uno");
    const nano = livingBoardProfile("nano");
    expect(pico.usb).toBe("Micro USB");
    expect(uno.usb).toBe("USB tipo B");
    expect(nano.usb).toBe("Mini USB");
    expect(uno.width).toBeGreaterThan(pico.width);
    expect(uno.depth).toBeGreaterThan(pico.depth * 2);
    expect(nano.width).toBeLessThan(pico.width);
    expect(pico.pinsPerSide * 2).toBe(40);
    expect(nano.pinsPerSide * 2).toBe(30);
    expect(uno.signalPoint).not.toEqual(pico.signalPoint);
    expect(nano.signalPoint).not.toEqual(pico.signalPoint);
    expect(uno.description).not.toContain("MicroPython");
  });

  it("keeps the same physical Nano when only its upload bootloader changes", () => {
    const nano = livingBoardProfile("nano");
    const oldNano = livingBoardProfile("nano-old");
    expect(oldNano).toMatchObject({
      shortName: nano.shortName,
      width: nano.width,
      depth: nano.depth,
      pinsPerSide: nano.pinsPerSide,
      usb: nano.usb,
      focus: nano.focus,
      signalPoint: nano.signalPoint,
    });
    expect(oldNano.description).toContain("bootloader antiguo");
  });

  it("frames each controller above the table without exceeding the camera orbit limit", () => {
    for (const board of ["pico", "uno", "nano", "nano-old"] as const) {
      const { target, position } = livingBoardProfile(board).focus;
      const distance = Math.hypot(...position.map((n, i) => n - target[i]));
      expect(position[1]).toBeGreaterThan(target[1]);
      expect(distance).toBeGreaterThanOrEqual(3);
      expect(distance).toBeLessThan(18);
    }
  });
});

describe("partial station readings in the living model", () => {
  it("keeps missing sensors and LED state unknown rather than inventing measurements", () => {
    expect(normalizedLivingReadings({ source: "hardware" })).toEqual({
      soil: undefined,
      light: undefined,
      led: undefined,
      source: "hardware",
    });
  });

  it("preserves real zero percentages and an explicitly off LED", () => {
    expect(
      normalizedLivingReadings({
        soil: 0,
        light: 0,
        led: false,
        source: "hardware",
      }),
    ).toEqual({
      soil: 0,
      light: 0,
      led: false,
      source: "hardware",
    });
  });

  it("keeps invalid numeric sensor values unknown", () => {
    expect(
      normalizedLivingReadings({
        soil: NaN,
        light: Infinity,
        source: "hardware",
      }),
    ).toMatchObject({
      soil: undefined,
      light: undefined,
    });
  });

  it("bounds sensor percentages without changing their source or LED", () => {
    expect(
      normalizedLivingReadings({
        soil: -9,
        light: 115,
        led: true,
        source: "simulation",
      }),
    ).toEqual({
      soil: 0,
      light: 100,
      led: true,
      source: "simulation",
    });
  });
});
