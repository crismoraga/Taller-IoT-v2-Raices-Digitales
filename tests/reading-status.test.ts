import { describe, expect, it } from "vitest";
import { readingTone } from "../web/lesson/reading-status";

describe("estado visual de una lectura", () => {
  it("acepta cero y temperaturas negativas como lecturas válidas", () => {
    expect(readingTone({ status: "READING", value: 0 })).toBe("valid");
    expect(readingTone({ status: "READING", value: -4 })).toBe("valid");
  });

  it("una respuesta vacía o no finita nunca aparece como medición válida", () => {
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(readingTone({ status: "READING", value })).toBe("error");
    }
  });

  it("conservar un número previo no transforma un fallo actual en éxito", () => {
    for (const status of ["ERROR", "NO_RESPONSE", "OUT_OF_RANGE"]) {
      expect(readingTone({ status, value: 25 })).toBe("error");
      expect(readingTone({ status, value: null })).toBe("error");
    }
  });

  it("separa la respuesta pendiente de calibración o verificación", () => {
    for (const status of ["NEEDS_CALIBRATION", "UNVERIFIED"]) {
      expect(readingTone({ status, value: 500 })).toBe("pending");
    }
    for (const status of ["CONNECTED", "DISABLED", "NEW_UNKNOWN_STATUS"]) {
      expect(readingTone({ status, value: null })).toBe("neutral");
    }
  });
});
