import { isPoint, pointXY } from "./breadboard";
import type { Circuit, PartInstance } from "./model";
import { partDef } from "./parts";
import { controllerPin } from "./boards";

/**
 * Geometría de dibujo compartida por la vista 2D, la escena 3D y la revisión de espacio.
 * Todo está en unidades de protoboard (1 = 2,54 mm); cada vista aplica su propia escala.
 */

export interface XY {
  x: number;
  y: number;
}

export type Outline =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number };

/**
 * Siluetas de variantes habituales, en pasos de 2,54 mm. Los módulos no son
 * tarjetas del mismo tamaño: la sonda capacitiva mide unos 98 × 23 mm y la
 * placa de nivel unos 63 × 19 mm. Conservamos el borde del conector junto al
 * banco; el cuerpo se extiende hacia afuera, sin tapar la protoboard.
 */
export function moduleBox(part: PartInstance): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const pins = partDef(part).pins.length;
  const at = part.at ?? { x: 0, y: -9.5 };
  const dimensions = {
    soil: { w: 9.1, h: 38.6, offset: 0 },
    water: { w: 7.5, h: 24.8, offset: 0 },
    pir: { w: 12.6, h: 9.1, offset: 3 },
    ds18b20: { w: 21.5, h: 8, offset: 10 },
    rain: { w: 5.5, h: 12.6, offset: 0 },
  }[part.type as "soil" | "water" | "pir" | "ds18b20" | "rain"];
  const w = dimensions?.w ?? Math.max(6.4, pins + 2.4);
  const h = dimensions?.h ?? 4.4;
  return {
    x: at.x + (dimensions?.offset ?? 0),
    y: at.y < 0 ? at.y + 4.4 - h : at.y,
    w,
    h,
  };
}

/** FC-37: la placa de gotas es otra pieza, unida al LM393 con dos hilos. */
export function rainPlateBox(part: PartInstance) {
  const module = moduleBox(part);
  return { x: module.x + module.w + 3, y: module.y, w: 19.7, h: 15.7 };
}

/** Incluye accesorios físicos para encuadrar ambos renderers. */
export function moduleBounds(part: PartInstance) {
  const box = moduleBox(part);
  if (part.type !== "rain") return box;
  const plate = rainPlateBox(part);
  return { ...box, w: plate.x + plate.w - box.x, h: Math.max(box.h, plate.h) };
}

/** Posición del pin de un módulo: en el borde que mira hacia la protoboard. */
export function modulePinXY(part: PartInstance, pinId: string): XY {
  const box = moduleBox(part);
  const pins = partDef(part).pins;
  const index = pins.findIndex((pin) => pin.id === pinId);
  if (index < 0)
    throw new Error(`La pieza ${part.label} no tiene el pin ${pinId}.`);
  const above = box.y < 0;
  // The row is a physical 2.54 mm header, rather than a fraction of PCB width.
  return {
    x: box.x + box.w / 2 + index - (pins.length - 1) / 2,
    y: above ? box.y + box.h : box.y,
  };
}

/** Dónde termina un cable: un agujero o el pin de una pieza. */
export function endpointXY(circuit: Circuit, endpoint: string): XY {
  if (isPoint(endpoint)) return pointXY(endpoint);
  const [partId, pinId] = endpoint.split(".");
  if (partId === "controller") return controllerPin(circuit.board, pinId);
  const part = circuit.parts.find((candidate) => candidate.id === partId);
  if (!part) throw new Error(`No existe la pieza de "${endpoint}".`);
  const hole = part.holes?.[pinId];
  return hole ? pointXY(hole) : modulePinXY(part, pinId);
}

/**
 * Cuerpo físico de las piezas que tapan agujeros vecinos, visto desde arriba.
 * Medidas habituales: buzzer de 12 mm, pulsador de 12 × 12 mm, HC-SR04 de 45 mm con dos
 * transductores de 16 mm, módulo DHT11 de 14 mm, potenciómetro de 9,5 mm.
 */
export function bodyOutline(part: PartInstance): Outline[] {
  if (!part.holes) return [];
  const points = Object.values(part.holes).map((hole) => pointXY(hole));
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  // Las piezas enchufadas en la letra a miran hacia afuera (y crece); en la j, al revés.
  const outward = cy > 8.5 ? 1 : -1;
  switch (part.type) {
    case "buzzer":
      return [{ kind: "circle", cx, cy, r: 2.36 }];
    case "button":
      return [{ kind: "rect", x: cx - 2.35, y: cy - 2.35, w: 4.7, h: 4.7 }];
    case "potentiometer":
      return [{ kind: "rect", x: cx - 1.9, y: cy + 0.3, w: 3.8, h: 2.6 }];
    case "dht11":
      return [
        {
          kind: "rect",
          x: cx - 2.8,
          y: outward > 0 ? cy + 0.35 : cy - 3.1,
          w: 5.6,
          h: 2.75,
        },
      ];
    case "hcsr04": {
      const depth = 5.3;
      const top = outward > 0 ? cy + 0.45 : cy - 0.45 - depth;
      return [-5.1, 5.1].map((offset) => ({
        kind: "rect" as const,
        x: cx + offset - 3.15,
        y: top,
        w: 6.3,
        h: depth,
      }));
    }
    default:
      return [];
  }
}

export function insideOutline(
  point: XY,
  outline: Outline,
  margin = 0,
): boolean {
  if (outline.kind === "circle")
    return (
      Math.hypot(point.x - outline.cx, point.y - outline.cy) <
      outline.r + margin
    );
  return (
    point.x > outline.x - margin &&
    point.x < outline.x + outline.w + margin &&
    point.y > outline.y - margin &&
    point.y < outline.y + outline.h + margin
  );
}

/**
 * Revisión de espacio: ningún cable ni pata puede entrar en un agujero que queda tapado
 * por el cuerpo de otra pieza. Devuelve una frase por cada choque.
 */
export function clearanceProblems(circuit: Circuit): string[] {
  const problems: string[] = [];
  const used: { hole: string; owner: string; partId?: string }[] = [];
  for (const part of circuit.parts)
    for (const [pin, hole] of Object.entries(part.holes ?? {}))
      used.push({ hole, owner: `${part.label} (${pin})`, partId: part.id });
  for (const wire of circuit.wires)
    for (const end of [wire.from, wire.to])
      if (isPoint(end)) used.push({ hole: end, owner: `el cable ${wire.id}` });
  for (const part of circuit.parts) {
    for (const outline of bodyOutline(part))
      for (const entry of used) {
        if (entry.partId === part.id) continue;
        if (insideOutline(pointXY(entry.hole), outline))
          problems.push(
            `${entry.owner} usa ${entry.hole}, que queda tapado por ${part.label}.`,
          );
      }
  }
  return problems;
}

/** Caja que contiene un conjunto de puntos, con margen. */
export function boundsOf(
  points: XY[],
  pad = 2,
): { x: number; y: number; w: number; h: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}
