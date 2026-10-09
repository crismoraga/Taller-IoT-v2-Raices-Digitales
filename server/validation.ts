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
const sensor = z.enum(sensors);
const finite = z.number().finite();
export const readingSchema = z
  .object({
    sensor,
    value: finite.min(-100000).max(100000).nullable(),
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
    raw: finite.optional(),
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
const readingsArray = z
  .array(readingSchema)
  .min(1)
  .max(32)
  .refine(
    (values) =>
      new Set(values.map((value) => value.sensor)).size === values.length,
    { message: "Cada sensor puede aparecer una sola vez por lote." },
  );
export const readingBatchSchema = z
  .object({ readings: readingsArray })
  .strict();
export const ingestSchema = z
  .object({
    readings: readingsArray,
    source: z.enum(["hardware", "simulation"]),
    diagnostics: z
      .record(
        z.string().max(64),
        z.union([z.string().max(1000), finite, z.boolean(), z.null()]),
      )
      .optional(),
  })
  .strict();
const safeKey = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
const calibration = z
  .object({ dry: finite.min(0).max(65535), wet: finite.min(0).max(65535) })
  .strict()
  .refine((v) => Math.abs(v.dry - v.wet) >= 8, {
    message:
      "La diferencia seco/húmedo debe ser al menos 8 unidades ADC; Pico requiere 500.",
  });
export const sessionPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    groupNumber: z.number().int().min(1).max(10).optional(),
    progress: z.array(z.string().max(50)).max(100).optional(),
    drafts: z
      .record(safeKey, z.string().max(100000))
      .refine(
        (v) =>
          Object.keys(v).length <= 50 &&
          Object.values(v).reduce((n, s) => n + s.length, 0) <= 500000,
        { message: "Demasiado código guardado." },
      )
      .optional(),
    calibrations: z
      .partialRecord(z.enum(["soil", "light", "water_level"]), calibration)
      .optional(),
    sensorEnabled: z.partialRecord(sensor, z.boolean()).optional(),
    lastRun: z
      .object({
        lessonId: safeKey,
        board: z.enum(["pico", "uno", "nano", "nano-old"]),
        code: z.string().max(100000),
        at: z.iso.datetime({ offset: true }),
      })
      .strict()
      .optional(),
  })
  .strict();
export const sessionCreateSchema = sessionPatchSchema.pick({
  name: true,
  groupNumber: true,
});
export const ruleSchema = z
  .object({
    sensor,
    min: finite.min(-100000).max(100000).nullable().optional().default(null),
    max: finite.min(-100000).max(100000).nullable().optional().default(null),
    hysteresis: finite.min(0).max(100000).default(2),
    cooldown: z.number().int().min(10).max(86400).default(120),
  })
  .strict()
  .refine((v) => v.min !== null || v.max !== null, {
    message: "Define al menos un límite.",
  })
  .refine((v) => v.min === null || v.max === null || v.min < v.max, {
    message: "El mínimo debe ser menor que el máximo.",
  })
  .refine(
    (v) => v.min === null || v.max === null || v.hysteresis * 2 < v.max - v.min,
    { message: "La histéresis debe ser menor que la mitad del intervalo." },
  );
export type Reading = z.infer<typeof readingSchema> & {
  deviceId?: string;
  source?: "hardware" | "simulation";
  timestamp?: string;
};
export type Rule = z.infer<typeof ruleSchema> & { id: string };
