import { resolve } from "node:path";

export interface Config {
  databasePath: string;
  origins: string[];
  secureCookies: boolean;
  teacherPassword: string;
  encryptionKey?: string;
  sessionDays: number;
  retentionDays: number;
  deviceOfflineSeconds: number;
  deviceAuditSeconds: number;
  pairingSeconds: number;
  arduinoCli: string;
  arduinoSandbox: boolean;
  arduinoServiceUrl?: string;
  arduinoServiceToken?: string;
  firmwarePath: string;
  staticPath: string;
  now: () => number;
  logger: boolean;
}

export function configuration(overrides: Partial<Config> = {}): Config {
  const production = process.env.NODE_ENV === "production";
  const origins = (
    process.env.APP_ORIGIN ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001"
  )
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const config: Config = {
    databasePath: resolve(process.env.DATABASE_PATH || "data/raices.sqlite"),
    origins,
    secureCookies: production,
    teacherPassword: process.env.TEACHER_PASSWORD || "",
    encryptionKey: process.env.SECRETS_KEY,
    sessionDays: Number(process.env.SESSION_DAYS || 7),
    retentionDays: Number(process.env.RETENTION_DAYS || 30),
    deviceOfflineSeconds: Number(process.env.DEVICE_OFFLINE_SECONDS || 120),
    deviceAuditSeconds: Number(process.env.DEVICE_AUDIT_SECONDS || 20),
    pairingSeconds: 300,
    arduinoCli:
      process.env.ARDUINO_CLI_PATH ||
      (process.platform === "win32"
        ? resolve("tools/arduino-cli/arduino-cli.exe")
        : "arduino-cli"),
    arduinoSandbox: process.env.ARDUINO_SANDBOX === "docker",
    arduinoServiceUrl: process.env.ARDUINO_SERVICE_URL,
    arduinoServiceToken: process.env.ARDUINO_SERVICE_TOKEN,
    firmwarePath: resolve("firmware"),
    staticPath: resolve("dist"),
    now: Date.now,
    logger: true,
    ...overrides,
  };
  for (const field of [
    "sessionDays",
    "retentionDays",
    "pairingSeconds",
    "deviceOfflineSeconds",
    "deviceAuditSeconds",
  ] as const) {
    if (!Number.isFinite(config[field]) || config[field] <= 0)
      throw new Error(`Configuración inválida: ${field}`);
  }
  if (
    config.encryptionKey &&
    Buffer.from(config.encryptionKey, "base64").length !== 32
  )
    throw new Error(
      "SECRETS_KEY debe contener exactamente 32 bytes codificados en base64.",
    );
  if (
    config.secureCookies &&
    (!config.origins.length ||
      config.origins.some((origin) => !origin.startsWith("https://")))
  )
    throw new Error("APP_ORIGIN debe especificar HTTPS en producción.");
  if (config.secureCookies && config.teacherPassword.length < 12)
    throw new Error(
      "TEACHER_PASSWORD requiere al menos 12 caracteres en producción.",
    );
  if (config.secureCookies && !config.encryptionKey)
    throw new Error("SECRETS_KEY es obligatoria en producción.");
  return config;
}
