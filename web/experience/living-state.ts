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
  sensorPin: "GP26" | "A0";
}

/** Board placement shared by the model, focus ring and signal attachment. */
export const LIVING_BOARD_POSITION: Point = [-2.03, 0.1, 0.7];
export const LIVING_BOARD_ROTATION = -0.22;

function placedContact(point: Point, uno = false): Point {
  const [x, y, z] = point;
  return [
    LIVING_BOARD_POSITION[0] +
      Math.cos(LIVING_BOARD_ROTATION) * x +
      Math.sin(LIVING_BOARD_ROTATION) * z,
    (uno ? 0.035 : LIVING_BOARD_POSITION[1]) + y,
    LIVING_BOARD_POSITION[2] -
      Math.sin(LIVING_BOARD_ROTATION) * x +
      Math.cos(LIVING_BOARD_ROTATION) * z,
  ];
}

const picoSignal = placedContact([-0.02826, 0.186, -0.2155]);
const nanoSignal = placedContact([-0.26828, 0.186, 0.181]);
const unoSignal = placedContact([0.13, 0.174, 0.525], true);

const BOARD_PROFILES: Record<Board, LivingBoardProfile> = {
  pico: {
    shortName: "Pico",
    width: 1.15,
    depth: 0.475,
    pinsPerSide: 20,
    color: "#277653",
    usb: "Micro USB",
    description:
      "MicroPython, Micro USB y 40 pines. GP26 recibe la humedad; GP2 controla tu LED.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.12, 2.6, 3.12] },
    signalPoint: picoSignal,
    sensorPin: "GP26",
  },
  uno: {
    shortName: "Arduino Uno",
    width: 1.52,
    depth: 1.18,
    pinsPerSide: 0,
    color: "#277d87",
    usb: "USB tipo B",
    description:
      "C++ y USB tipo B. Inserta los cables en sus conectores negros: A0 recibe la humedad y D2 controla tu LED.",
    focus: { target: [-2.03, 0.27, 0.7], position: [-0.85, 3.0, 3.3] },
    signalPoint: unoSignal,
    sensorPin: "A0",
  },
  nano: {
    shortName: "Arduino Nano",
    width: 1.015,
    depth: 0.406,
    pinsPerSide: 15,
    color: "#287b87",
    usb: "Mini USB",
    description:
      "C++, Mini USB y 30 pines. A0 recibe la humedad; D2 controla tu LED.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.15, 2.4, 3.02] },
    signalPoint: nanoSignal,
    sensorPin: "A0",
  },
  "nano-old": {
    shortName: "Arduino Nano",
    width: 1.015,
    depth: 0.406,
    pinsPerSide: 15,
    color: "#287b87",
    usb: "Mini USB",
    description:
      "El mismo Nano de 30 pines y Mini USB, con bootloader antiguo. A0 recibe la humedad; D2 controla tu LED.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.15, 2.4, 3.02] },
    signalPoint: nanoSignal,
    sensorPin: "A0",
  },
  "nano-168": {
    shortName: "Arduino Nano",
    width: 1.015,
    depth: 0.406,
    pinsPerSide: 15,
    color: "#287b87",
    usb: "Mini USB",
    description:
      "Nano clásico con ATmega168, C++ y 30 pines. A0 recibe la humedad; D2 controla tu LED. El firmware se adapta a su memoria.",
    focus: { target: [-2.03, 0.35, 0.7], position: [-1.15, 2.4, 3.02] },
    signalPoint: nanoSignal,
    sensorPin: "A0",
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

/** Copy follows available measurements, including zero and an explicitly off LED. */
export function livingReadingText(
  readings: LivingReadings,
  part: "plant" | "sensor" | "led",
): string {
  const values = normalizedLivingReadings(readings);
  if (part === "led")
    return values.led === undefined
      ? "El estado del LED aparecerá con tu próxima lectura."
      : `LED de tu estación: ${values.led ? "encendido" : "apagado"}.`;
  const measurements = [
    values.soil === undefined
      ? undefined
      : `Humedad ${Math.round(values.soil)}%`,
    part === "plant" && values.light !== undefined
      ? `Luz ${Math.round(values.light)}%`
      : undefined,
  ].filter(Boolean);
  return measurements.length
    ? `${measurements.join(" · ")}.`
    : part === "plant"
      ? "Tus próximas lecturas de humedad y luz aparecerán aquí."
      : "Tu próxima lectura de humedad aparecerá aquí.";
}
