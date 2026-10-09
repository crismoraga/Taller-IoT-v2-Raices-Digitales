export type Reading = {
  sensor: string;
  value: number | null;
  unit: string;
  status: string;
  raw?: number;
  confidence?: string;
  error?: string;
  timestamp?: string;
  deviceId?: string;
  source?: string;
};
export type Session = {
  id: string;
  name: string;
  groupNumber: number;
  progress: string[];
  drafts: Record<string, string>;
  calibrations: Record<string, { dry: number; wet: number }>;
  sensorEnabled: Record<string, boolean>;
  createdAt: string;
  lastRun?: {
    lessonId: string;
    board: "pico" | "uno" | "nano" | "nano-old";
    code: string;
    at: string;
  };
};
export type Device = {
  id: string;
  name: string;
  source: string;
  lastSeen: string;
  diagnostics?: Record<string, unknown>;
  revoked?: boolean;
  online?: boolean;
};
export type Rule = {
  id: string;
  sensor: string;
  min: number;
  max: number;
  hysteresis: number;
  cooldown: number;
};
export type Alert = {
  id: string;
  sensor: string;
  type: string;
  message: string;
  createdAt: string;
  delivery?: string;
};
export type DashboardData = {
  devices: Device[];
  latest: Reading[];
  history: Reading[];
  rules: Rule[];
  alerts: Alert[];
};
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(path === "/arduino/compile" ? 65000 : 15000),
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.message || data?.error || `El servidor respondió con error ${response.status}.`,
      response.status,
    );
  if (data === null)
    throw new ApiError("El servidor no respondió correctamente. Vuelve a intentar.", 502);
  return data as T;
}
export const post = <T = Record<string, unknown>>(
  path: string,
  body: unknown,
) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const sensorLabels: Record<string, string> = {
  soil: "Humedad del suelo",
  soil_temperature: "Temperatura del suelo",
  air_temperature: "Temperatura ambiente",
  air_humidity: "Humedad ambiente",
  light: "Luz relativa",
  rain: "Presencia de lluvia",
  water_level: "Nivel de agua",
  distance: "Distancia",
  motion: "Movimiento",
};
export const statusLabels: Record<string, string> = {
  READING: "Lectura válida",
  CONNECTED: "Conectado",
  NEEDS_CALIBRATION: "Por calibrar",
  NO_RESPONSE: "Sin respuesta",
  OUT_OF_RANGE: "Fuera de rango",
  UNVERIFIED: "Por verificar",
  DISABLED: "Deshabilitado",
  ERROR: "Error",
};
