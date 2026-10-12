import { describe, expect, it } from "vitest";
import { normalizedLivingReadings } from "../web/experience/living-state";

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
