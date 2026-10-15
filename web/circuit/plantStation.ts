import { sensors } from "../../shared/telemetry";
import type { Session } from "../lib/api";

/** One physical piece can supply two readings (the DHT11). */
export const PLANT_SENSORS = [
  {
    id: "light",
    label: "Luz · LDR 5549",
    short: "Luz",
    lesson: "ldr",
    part: "ldr",
    readings: ["light"],
    placement:
      "Deja la LDR junto a las hojas, mirando a la luz. Mantén sus patas en los mismos agujeros de la protoboard.",
    response: "Tápala con la mano y destápala: la lectura de luz debe cambiar.",
  },
  {
    id: "climate",
    label: "Aire · DHT11",
    short: "Aire",
    lesson: "dht11",
    part: "dht",
    readings: ["air_temperature", "air_humidity"],
    placement:
      "Sitúa la protoboard al lado de la maceta, con la rejilla del DHT11 libre y a la altura de las hojas.",
    response:
      "Observa temperatura y humedad del aire. El DHT11 tarda al menos dos segundos entre muestras.",
  },
  {
    id: "soil",
    label: "Suelo · Capacitivo v1.2",
    short: "Suelo",
    lesson: "soil",
    part: "soil",
    readings: ["soil"],
    placement:
      "Introduce la parte larga de la sonda en la tierra, hasta su marca. Deja el conector y la electrónica sobre la tierra.",
    response:
      "Compara tierra seca y húmeda; después guarda ambas referencias en Calibración para obtener un porcentaje relativo.",
  },
  {
    id: "soil_temperature",
    label: "Temperatura · DS18B20",
    short: "Temperatura",
    lesson: "ds18b20",
    part: "ds",
    readings: ["soil_temperature"],
    placement:
      "Coloca sólo la cápsula metálica en la tierra húmeda o en el agua del depósito. El extremo del cable queda junto a la protoboard.",
    response:
      "Sostén la cápsula entre los dedos y comprueba que la temperatura cambia gradualmente.",
  },
  {
    id: "rain",
    label: "Lluvia · FC-37 + LM393",
    short: "Lluvia",
    lesson: "rain",
    part: "rain",
    readings: ["rain"],
    placement:
      "Pon la placa de pistas junto a la maceta, orientada hacia arriba. El módulo LM393 queda al lado de la protoboard y se une a la placa con dos hilos.",
    response:
      "Pon unas gotas en la placa. La lectura indica detección o ausencia de agua; no mide milímetros de lluvia.",
  },
  {
    id: "water_level",
    label: "Nivel de agua",
    short: "Nivel",
    lesson: "water_level",
    part: "water",
    readings: ["water_level"],
    placement:
      "Pon las pistas largas verticales en el depósito o vaso de agua, dejando el conector por encima del nivel del agua.",
    response:
      "Sube y baja las pistas respecto al agua. Guarda vacío y máximo en Calibración para una escala relativa de nivel.",
  },
  {
    id: "distance",
    label: "Distancia · HC-SR04",
    short: "Distancia",
    lesson: "distance",
    part: "hc",
    readings: ["distance"],
    placement:
      "Orienta los dos cilindros hacia la superficie del depósito o hacia un objeto. La distancia se mide desde el frente del sensor, en centímetros.",
    response:
      "Acerca y aleja una superficie plana. Esta lectura es distancia; no se convierte automáticamente en nivel de agua.",
  },
  {
    id: "motion",
    label: "Movimiento · HC-SR501",
    short: "Movimiento",
    lesson: "motion",
    part: "pir",
    readings: ["motion"],
    placement:
      "Deja la cúpula blanca mirando al espacio junto a la planta, donde pasarán las personas.",
    response:
      "Espera el primer minuto de estabilización y mueve una mano delante. Detecta cambios de movimiento, no la identidad ni la presencia permanente de alguien.",
  },
] as const;

export type PlantSensorId = (typeof PLANT_SENSORS)[number]["id"];
export const FIRST_PLANT_SENSORS: PlantSensorId[] = ["light", "climate"];

/** Stable catalogue order makes the renderer, storage and installed drivers agree. */
export function normalizePlantSensors(
  input: unknown,
): PlantSensorId[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return PLANT_SENSORS.filter((sensor) => input.includes(sensor.id)).map(
    (sensor) => sensor.id,
  );
}

export function initialPlantSensors(
  saved: unknown,
  enabled: Session["sensorEnabled"] = {},
): PlantSensorId[] {
  const restored = normalizePlantSensors(saved);
  if (restored) return restored;
  const existing = PLANT_SENSORS.filter((sensor) =>
    sensor.readings.some((reading) => enabled[reading] === true),
  ).map((sensor) => sensor.id);
  return existing.length ? existing : [...FIRST_PLANT_SENSORS];
}

/** An absent physical sensor must be disabled, even if an older profile enabled it. */
export function plantSensorFlags(
  selected: readonly PlantSensorId[],
): Record<string, boolean> {
  const enabled = Object.fromEntries(sensors.map((sensor) => [sensor, false]));
  for (const sensor of PLANT_SENSORS)
    if (selected.includes(sensor.id))
      for (const reading of sensor.readings) enabled[reading] = true;
  return enabled;
}
