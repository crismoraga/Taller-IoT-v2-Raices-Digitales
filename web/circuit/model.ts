import type { PointId } from "./breadboard";

/**
 * Modelo declarativo de un montaje. De estos mismos datos salen:
 *  - el diagrama de protoboard (2D) y la escena 3D,
 *  - la lista de pasos de cableado con sus agujeros exactos,
 *  - la revisión eléctrica automática (netlist.ts) que corre en los tests.
 */

export type WireColor =
  | "rojo"
  | "naranja"
  | "negro"
  | "amarillo"
  | "verde"
  | "azul"
  | "blanco"
  | "morado"
  | "gris";

export const WIRE_HEX: Record<WireColor, string> = {
  rojo: "#d64545",
  naranja: "#e8833a",
  negro: "#1d2730",
  amarillo: "#e3b324",
  verde: "#2f9e6b",
  azul: "#3e8fd0",
  blanco: "#e9eef2",
  morado: "#8b6fd6",
  gris: "#8a98a5",
};

/** Convención del taller: rojo = 3,3 V, naranja = 5 V, negro = GND, el resto = señales. */
export const WIRE_MEANING: Partial<Record<WireColor, string>> = {
  rojo: "alimentación de 3,3 V",
  naranja: "alimentación de 5 V",
  negro: "tierra (GND)",
};

export type PartType =
  | "resistor"
  | "led"
  | "ldr"
  | "button"
  | "buzzer"
  | "potentiometer"
  | "lm35"
  | "tilt"
  | "soil"
  | "ds18b20"
  | "dht11"
  | "rain"
  | "water"
  | "hcsr04"
  | "pir"
  | "generic";

/** Un terminal eléctrico: agujero de la protoboard o pin de una pieza ("led.anodo"). */
export type Endpoint = PointId | `${string}.${string}`;

export interface PartInstance {
  id: string;
  type: PartType;
  /** Nombre visible: "Resistencia de 220 Ω". */
  label: string;
  /** Valor en ohmios (resistencias), color del LED, etc. */
  props?: { ohms?: number; color?: "rojo" | "amarillo" | "azul"; vf?: number; variant?: string };
  /** Piezas que se insertan en la protoboard: pin → agujero. */
  holes?: Record<string, PointId>;
  /**
   * Módulos que quedan fuera de la protoboard (con cable): posición de su esquina superior
   * izquierda en unidades de dibujo. Sus pines se conectan con `wires`.
   */
  at?: { x: number; y: number };
  /** Pines de un módulo genérico, en orden. */
  pins?: string[];
}

export interface Wire {
  id: string;
  from: Endpoint;
  to: Endpoint;
  color: WireColor;
  /**
   * jumper: cable macho-macho entre dos agujeros.
   * cable: hilo propio del sensor o cable hembra-macho desde un módulo hasta un agujero.
   */
  kind?: "jumper" | "cable";
  /** Qué transporta, para rotular sin depender del color: "3V3", "GND", "señal GP2". */
  carries: string;
}

export type StepKind = "prepare" | "place" | "wire" | "check";

export interface WiringStep {
  id: string;
  kind: StepKind;
  /** Una acción, en imperativo y con las coordenadas: "Cable negro: de a27 al riel azul". */
  title: string;
  /** Cómo hacerlo, en una o dos frases cortas. */
  detail: string;
  /** Piezas y cables que se colocan en este paso. */
  parts?: string[];
  wires?: string[];
  /** Por qué se hace así (se muestra al pedirlo). */
  why?: string;
  /** Advertencia eléctrica que aplica exactamente a este paso. */
  warning?: string;
  tip?: string;
  /** Comprobación que el estudiante marca antes de avanzar. */
  verify?: string;
  /** Paso que ya quedó armado en una actividad anterior (rieles de alimentación). */
  shared?: boolean;
  /** Agujeros a destacar cuando el paso no coloca nada. */
  focus?: PointId[];
}

export interface Circuit {
  id: string;
  title: string;
  parts: PartInstance[];
  wires: Wire[];
  steps: WiringStep[];
  /**
   * Netlist esperado: cada grupo es un conjunto de terminales que deben quedar unidos.
   * Terminales: "pico:GP2", "pico:GND", "pico:3V3", "pico:VBUS" o "pieza.pin".
   * La revisión exige que el montaje físico produzca exactamente estas uniones, ni más ni menos.
   */
  nets: string[][];
  /** Ventana inicial del diagrama: números de la protoboard que deben verse. */
  view?: { from: number; to: number };
}

/* ── Ayudantes para escribir montajes de forma compacta ───────── */

export const resistor = (
  id: string,
  ohms: number,
  a: PointId,
  b: PointId,
): PartInstance => ({
  id,
  type: "resistor",
  label: `Resistencia de ${formatOhms(ohms)}`,
  props: { ohms },
  holes: { a, b },
});

export const jumper = (
  id: string,
  from: Endpoint,
  to: Endpoint,
  color: WireColor,
  carries: string,
): Wire => ({ id, from, to, color, kind: "jumper", carries });

export const cable = (
  id: string,
  from: Endpoint,
  to: Endpoint,
  color: WireColor,
  carries: string,
): Wire => ({ id, from, to, color, kind: "cable", carries });

export function formatOhms(ohms: number): string {
  return ohms >= 1000
    ? `${(ohms / 1000).toLocaleString("es-CL")} kΩ`
    : `${ohms} Ω`;
}

/** Bandas de color de una resistencia de 4 bandas (5 % de tolerancia). */
export function resistorBands(ohms: number): [string, string, string, string] {
  const colors = [
    "#1d1d1b", // negro 0
    "#7a4a21", // café 1
    "#c93030", // rojo 2
    "#e67a1c", // naranja 3
    "#e8c820", // amarillo 4
    "#2e9a4f", // verde 5
    "#2f66c4", // azul 6
    "#7d4bb5", // violeta 7
    "#8a8f94", // gris 8
    "#f4f4f1", // blanco 9
  ];
  const digits = ohms.toExponential(1).replace(".", "").split("e");
  const first = Number(digits[0][0]);
  const second = Number(digits[0][1]);
  const multiplier = Number(digits[1]) - 1;
  return [colors[first], colors[second], colors[multiplier], "#c9a227"];
}
export function resistorBandNames(ohms: number): string {
  const names = ["negro", "café", "rojo", "naranja", "amarillo", "verde", "azul", "violeta", "gris", "blanco"];
  const digits = ohms.toExponential(1).replace(".", "").split("e");
  return `${names[Number(digits[0][0])]}, ${names[Number(digits[0][1])]}, ${names[Number(digits[1]) - 1]} y dorado`;
}

/** Une varios fragmentos en un solo montaje, sin repetir piezas, cables ni pasos compartidos. */
export function compose(
  id: string,
  title: string,
  fragments: Array<Pick<Circuit, "parts" | "wires" | "steps" | "nets">>,
  view?: Circuit["view"],
): Circuit {
  const parts = new Map<string, PartInstance>();
  const wires = new Map<string, Wire>();
  const steps = new Map<string, WiringStep>();
  const groups: string[][] = [];
  for (const fragment of fragments) {
    for (const part of fragment.parts) parts.set(part.id, part);
    for (const wire of fragment.wires) wires.set(wire.id, wire);
    for (const step of fragment.steps) if (!steps.has(step.id)) steps.set(step.id, step);
    groups.push(...fragment.nets);
  }
  return {
    id,
    title,
    parts: [...parts.values()],
    wires: [...wires.values()],
    steps: [...steps.values()],
    nets: mergeGroups(groups),
    view,
  };
}

/** Funde los grupos que comparten algún terminal (p. ej. todos los que tocan pico:GND). */
export function mergeGroups(groups: string[][]): string[][] {
  const merged: Set<string>[] = [];
  for (const group of groups) {
    const touching = merged.filter((set) => group.some((terminal) => set.has(terminal)));
    const union = new Set(group);
    for (const set of touching) {
      for (const terminal of set) union.add(terminal);
      merged.splice(merged.indexOf(set), 1);
    }
    merged.push(union);
  }
  return merged.map((set) => [...set]);
}
