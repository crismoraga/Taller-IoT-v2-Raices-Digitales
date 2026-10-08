import sketch from "../../firmware/arduino/station.ino?raw";

/** Generates a fully compilable AVR station using only the installed kit. */
export function arduinoStationSketch(
  calibrations: Record<string, { dry: number; wet: number }> = {},
  enabled: Record<string, boolean> = {},
): string {
  const isEnabled = (key: string) => enabled[key] === true;
  const dht =
    isEnabled("dht11") ||
    isEnabled("air_temperature") ||
    isEnabled("air_humidity");
  const definitions: Record<string, boolean> = {
    SOIL: isEnabled("soil"),
    LIGHT: isEnabled("light"),
    WATER: isEnabled("water_level"),
    RAIN: isEnabled("rain"),
    PIR: isEnabled("motion"),
    DS: isEnabled("soil_temperature"),
    DISTANCE: isEnabled("distance"),
    DHT: dht,
    AIR_TEMP: isEnabled("dht11") || isEnabled("air_temperature"),
    AIR_HUMIDITY: isEnabled("dht11") || isEnabled("air_humidity"),
  };
  const constants = Object.entries(definitions).map(
    ([key, value]) => `const bool ENABLE_${key} = ${value};`,
  );
  for (const [key, name] of [
    ["soil", "SOIL"],
    ["light", "LIGHT"],
    ["water_level", "WATER"],
  ]) {
    const calibration = calibrations[key];
    const valid =
      calibration &&
      Number.isInteger(calibration.dry) &&
      Number.isInteger(calibration.wet) &&
      calibration.dry >= 0 &&
      calibration.wet >= 0 &&
      calibration.dry <= 1023 &&
      calibration.wet <= 1023 &&
      Math.abs(calibration.dry - calibration.wet) >= 8;
    constants.push(`const int ${name}_DRY = ${valid ? calibration.dry : -1};`);
    constants.push(`const int ${name}_WET = ${valid ? calibration.wet : -1};`);
  }
  return `${constants.join("\n")}\n\n${sketch}`;
}
