import { describe, expect, it } from "vitest";
import { arduinoStationSketch } from "../../web/lib/arduino";

describe("station firmware configuration", () => {
  it("lets each DHT channel override a legacy whole-module flag", () => {
    const independent = arduinoStationSketch({}, {
      dht11: true,
      air_temperature: false,
      air_humidity: true,
    });
    expect(independent).toContain("const bool ENABLE_DHT = true;");
    expect(independent).toContain("const bool ENABLE_AIR_TEMP = false;");
    expect(independent).toContain("const bool ENABLE_AIR_HUMIDITY = true;");
    const disabled = arduinoStationSketch({}, {
      dht11: true,
      air_temperature: false,
      air_humidity: false,
    });
    expect(disabled).toContain("const bool ENABLE_DHT = false;");
    const migrated = arduinoStationSketch({}, {
      dht11: false,
      air_temperature: true,
    });
    expect(migrated).toContain("const bool ENABLE_AIR_TEMP = true;");
    expect(migrated).toContain("const bool ENABLE_AIR_HUMIDITY = false;");
  });

  it("accepts 10-bit ATmega168 references and keeps Pico references out of AVR", () => {
    const code = arduinoStationSketch({
      soil: { dry: 900, wet: 200, board: "nano-168" },
      light: { dry: 50000, wet: 10000, board: "pico" },
    }, { soil: true });
    expect(code).toContain("const int SOIL_DRY = 900;");
    expect(code).toContain("const int SOIL_WET = 200;");
    expect(code).toContain("const int LIGHT_DRY = -1;");
    expect(code).toContain("const bool ENABLE_SOIL = true;");
    expect(code).toContain("const bool ENABLE_LIGHT = false;");
  });

  it("keeps malformed optional configuration disabled without generating invalid literals", () => {
    const code = arduinoStationSketch(
      null as unknown as Parameters<typeof arduinoStationSketch>[0],
      null as unknown as Parameters<typeof arduinoStationSketch>[1],
    );
    expect(code).toContain("const bool ENABLE_DHT = false;");
    expect(code).toContain("const int SOIL_DRY = -1;");
    expect(code).not.toContain("const int SOIL_DRY = undefined;");
  });
});
