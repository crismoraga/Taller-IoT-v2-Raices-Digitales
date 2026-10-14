import { z } from "zod";

export const sensors = [
  "soil",
  "soil_temperature",
  "air_temperature",
  "air_humidity",
  "light",
  "rain",
  "water_level",
  "distance",
  "motion",
] as const;
export const sensorUnits: Record<string, string> = {
  soil: "%",
  soil_temperature: "°C",
  air_temperature: "°C",
  air_humidity: "%",
  light: "%",
  rain: "0/1",
  water_level: "%",
  distance: "cm",
  motion: "0/1",
};
export const readingSchema = z
  .object({
    sensor: z.enum(sensors),
    value: z.number().finite().min(-100000).max(100000).nullable(),
    unit: z.string().max(32),
    status: z.enum([
      "READING",
      "NEEDS_CALIBRATION",
      "NO_RESPONSE",
      "OUT_OF_RANGE",
      "UNVERIFIED",
      "DISABLED",
      "ERROR",
    ]),
    raw: z.number().finite().optional(),
    confidence: z.string().max(100).optional(),
    error: z.string().max(500).optional(),
    timestamp: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((r) => r.status !== "READING" || r.value !== null, {
    message: "Una lectura válida requiere un valor numérico.",
  })
  .refine((r) => r.unit === sensorUnits[r.sensor], {
    message: "Unidad incompatible con el sensor.",
  });
