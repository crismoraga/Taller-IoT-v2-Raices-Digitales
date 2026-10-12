import type { Board } from "../lib/context";

type Point = [number, number, number];

/** The hero, its inspector and camera all describe the same selected controller. */
export interface LivingBoardProfile {
  shortName: string;
  width: number;
  depth: number;
  pinsPerSide: number;
  color: string;
  usb: "Micro USB" | "USB tipo B" | "Mini USB";
  description: string;
  focus: { target: Point; position: Point };
  signalPoint: Point;
}

const BOARD_PROFILES: Record<Board, LivingBoardProfile> = {
  pico: {
    shortName: "Pico W",
    width: 1.15,
    depth: 0.475,
    pinsPerSide: 20,
    color: "#277653",
    usb: "Micro USB",
    description:
      "Tu Raspberry Pi Pico W ejecuta MicroPython. Reconoce el Micro USB, las dos filas de 20 pines y la antena del extremo opuesto: aquí llegará la señal del sensor.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.12, 2.6, 3.12] },
    signalPoint: [-1.55, 0.41, 0.95],
  },
  uno: {
    shortName: "Arduino Uno",
    width: 1.52,
    depth: 1.18,
    pinsPerSide: 0,
    color: "#277d87",
    usb: "USB tipo B",
    description:
      "Tu Arduino Uno ejecuta C++. Reconoce el USB tipo B cuadrado y los conectores negros: los cables se insertan en sus agujeros. A0 recibe el sensor y D2 puede encender tu LED.",
    focus: { target: [-2.03, 0.27, 0.7], position: [-0.85, 3.0, 3.3] },
    signalPoint: [-1.56, 0.39, 1.16],
  },
  nano: {
    shortName: "Arduino Nano",
    width: 1.015,
    depth: 0.406,
    pinsPerSide: 15,
    color: "#287b87",
    usb: "Mini USB",
    description:
      "Tu Arduino Nano ejecuta C++. Su Mini USB y sus dos filas de 15 pines lo distinguen de la Pico. A0 recibe el sensor y D2 puede encender tu LED.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.15, 2.4, 3.02] },
    signalPoint: [-1.64, 0.4, 0.93],
  },
  "nano-old": {
    shortName: "Arduino Nano",
    width: 1.015,
    depth: 0.406,
    pinsPerSide: 15,
    color: "#287b87",
    usb: "Mini USB",
    description:
      "Tu Arduino Nano ejecuta C++. Conserva los mismos 30 pines y el Mini USB; esta variante usa el bootloader antiguo al cargar el programa. A0 recibe el sensor y D2 puede encender tu LED.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.15, 2.4, 3.02] },
    signalPoint: [-1.64, 0.4, 0.93],
  },
};

export function livingBoardProfile(board: Board): LivingBoardProfile {
  return BOARD_PROFILES[board];
}

/** Missing readings stay missing: a connected board may not report every sensor. */
export interface LivingReadings {
  soil?: number;
  light?: number;
  led?: boolean;
  source: "hardware" | "simulation";
}

export function normalizedLivingReadings(readings: LivingReadings) {
  const percent = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : undefined;
  return {
    soil: percent(readings.soil),
    light: percent(readings.light),
    led: typeof readings.led === "boolean" ? readings.led : undefined,
    source: readings.source,
  };
}
