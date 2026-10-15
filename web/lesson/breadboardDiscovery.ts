import type { Board } from "../lib/context";
import { circuitForBoard } from "../circuit/boards";
import { circuits } from "../circuit/layouts";
import {
  holesOfStrip,
  isPoint,
  stripOf,
  type PointId,
} from "../circuit/breadboard";

export const DISCOVERY_STEPS = [
  "groups",
  "gap",
  "rails",
  "pins",
  "path",
] as const;
export type DiscoveryStep = (typeof DISCOVERY_STEPS)[number];

/** The exercise uses the same conservative split-rail model as the real wiring. */
export function discoveryConnectedHoles(point: string): PointId[] {
  return isPoint(point) ? holesOfStrip(stripOf(point, true)) : [];
}

export function discoverySignalPath(board: Board) {
  const circuit = circuitForBoard(circuits.led, board);
  const wire = circuit.wires.find((candidate) => candidate.id === "w_led_sig")!;
  return {
    pin: board === "pico" ? "GP2" : "D2",
    from: wire.from,
    to: wire.to,
    color: wire.color,
  };
}

export function discoveryPinRoles(board: Board) {
  return [
    { pin: "GND", role: "La referencia y el camino de vuelta." },
    { pin: "3V3", role: "Alimentación de 3,3 voltios." },
    {
      pin: board === "pico" ? "VBUS" : "5V",
      role: "Alimentación de 5 voltios con USB conectado.",
    },
    {
      pin: board === "pico" ? "GP2" : "D2",
      role: "La salida digital que controlará nuestro LED.",
    },
    {
      pin: board === "pico" ? "GP26" : "A0",
      role: "La entrada analógica que leerá el sensor de suelo.",
    },
  ];
}

export function assessDiscoveryChoice(
  step: DiscoveryStep,
  choice: string,
  board: Board,
) {
  if (step === "pins") {
    const correct = choice === discoverySignalPath(board).pin;
    return {
      correct,
      message: correct
        ? `${choice} enviará la orden del programa. GND será el camino de vuelta.`
        : `${discoveryPinRoles(board).find((candidate) => candidate.pin === choice)?.role ?? "Elige un pin del modelo."} Para este LED usaremos ${discoverySignalPath(board).pin}.`,
    };
  }
  const anchor =
    step === "groups"
      ? "a26"
      : step === "gap"
        ? "e26"
        : step === "rails"
          ? "tn:30"
          : discoverySignalPath(board).to;
  const correct =
    choice !== anchor &&
    discoveryConnectedHoles(anchor).includes(choice as PointId);
  let message: string;
  if (correct) {
    message =
      step === "rails"
        ? "Estos agujeros pertenecen a la misma mitad del riel azul. El corte entre 31 y 33 los separa de la otra mitad."
        : step === "path"
          ? `${choice} recibe la misma señal que ${anchor}. La resistencia podrá tomarla desde c22 en el próximo montaje.`
          : `${anchor} y ${choice} están unidos por la misma tira metálica. No necesitas un cable entre ellos.`;
  } else if (choice === anchor) {
    message = `Ese es el punto de partida. Toca otro agujero que esté unido a ${anchor}.`;
  } else {
    message =
      step === "rails"
        ? "La línea roja y la azul son independientes. En este plano, las dos mitades del mismo riel también están separadas. Prueba en la mitad de 30–31."
        : `${choice} está en otro grupo. Busca el mismo número y el mismo lado del canal que ${anchor}.`;
  }
  return { correct, message };
}
