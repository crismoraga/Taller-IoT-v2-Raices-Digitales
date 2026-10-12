export const PICO_MODELS = {
  pico: { name: "Raspberry Pi Pico", wifi: false, firmware: "RPI_PICO" },
  "pico-w": { name: "Raspberry Pi Pico W", wifi: true, firmware: "RPI_PICO_W" },
  pico2: { name: "Raspberry Pi Pico 2", wifi: false, firmware: "RPI_PICO2" },
  "pico2-w": {
    name: "Raspberry Pi Pico 2 W",
    wifi: true,
    firmware: "RPI_PICO2_W",
  },
} as const;

export type PicoModel = keyof typeof PICO_MODELS;

export function isPicoModel(value: unknown): value is PicoModel {
  return typeof value === "string" && Object.hasOwn(PICO_MODELS, value);
}

export function picoFirmwareUrl(model: PicoModel): string {
  return `https://micropython.org/download/${PICO_MODELS[model].firmware}/`;
}
