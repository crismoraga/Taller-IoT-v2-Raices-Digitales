/**
 * Geometría y conectividad de una protoboard de 830 puntos (63 números × 10 letras + 4 rieles).
 *
 * Orientación de trabajo: horizontal, con el número 1 a la izquierda.
 *   riel superior:  + (rojo)  /  − (azul)
 *   letras j i h g f  ── canal central ──  e d c b a
 *   riel inferior:  + (rojo)  /  − (azul)
 *
 * Unidad de dibujo: 1 = un paso de 2,54 mm entre agujeros.
 * Regla eléctrica: en cada número, a–e están unidos entre sí y f–j están unidos entre sí;
 * el canal central los separa. Cada línea de riel une todos sus agujeros (algunas
 * protoboards la cortan al centro: por eso los montajes largos incluyen un puente).
 */

export const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;
export type Letter = (typeof LETTERS)[number];
export const COLUMNS = 63;

export type RailName = "tp" | "tn" | "bp" | "bn";
/** Agujero de la zona central, p. ej. "a4": letra a, número 4. */
export type HoleId = `${Letter}${number}`;
/** Agujero de riel, p. ej. "tn:3": riel superior negativo, frente al número 3. */
export type RailId = `${RailName}:${number}`;
export type PointId = HoleId | RailId;

/** Los rieles tienen 50 agujeros en 10 grupos de 5, alineados con estos números. */
export const RAIL_COLUMNS: number[] = Array.from({ length: 50 }, (_, index) =>
  3 + index + Math.floor(index / 5),
);
/** Muchas protoboards cortan cada riel entre los números 31 y 33. */
export const RAIL_SPLIT_AFTER = 31;

const LETTER_Y: Record<Letter, number> = {
  j: 3,
  i: 4,
  h: 5,
  g: 6,
  f: 7,
  e: 10,
  d: 11,
  c: 12,
  b: 13,
  a: 14,
};
const RAIL_Y: Record<RailName, number> = { tp: 0, tn: 1, bp: 16, bn: 17 };

export const BOARD = {
  /** Coordenada x del número 1. */
  x0: 2,
  width: COLUMNS + 3,
  height: 17,
  channelTop: LETTER_Y.f,
  channelBottom: LETTER_Y.e,
} as const;

export const RAIL_INFO: Record<
  RailName,
  { side: "superior" | "inferior"; sign: "+" | "−"; color: "rojo" | "azul"; label: string }
> = {
  tp: { side: "superior", sign: "+", color: "rojo", label: "riel rojo (+) de arriba" },
  tn: { side: "superior", sign: "−", color: "azul", label: "riel azul (−) de arriba" },
  bp: { side: "inferior", sign: "+", color: "rojo", label: "riel rojo (+) de abajo" },
  bn: { side: "inferior", sign: "−", color: "azul", label: "riel azul (−) de abajo" },
};

export type ParsedPoint =
  | { kind: "hole"; letter: Letter; column: number; half: "lower" | "upper" }
  | { kind: "rail"; rail: RailName; column: number };

export function parsePoint(id: string): ParsedPoint {
  const rail = /^(tp|tn|bp|bn):(\d{1,2})$/.exec(id);
  if (rail) {
    const column = Number(rail[2]);
    if (!RAIL_COLUMNS.includes(column))
      throw new Error(`"${id}": los rieles no tienen agujero frente al número ${column}.`);
    return { kind: "rail", rail: rail[1] as RailName, column };
  }
  const hole = /^([a-j])(\d{1,2})$/.exec(id);
  if (!hole) throw new Error(`"${id}" no es un agujero de la protoboard.`);
  const column = Number(hole[2]);
  if (column < 1 || column > COLUMNS)
    throw new Error(`"${id}": la protoboard llega hasta el número ${COLUMNS}.`);
  const letter = hole[1] as Letter;
  return {
    kind: "hole",
    letter,
    column,
    half: LETTERS.indexOf(letter) < 5 ? "lower" : "upper",
  };
}

export function isPoint(id: string): id is PointId {
  try {
    parsePoint(id);
    return true;
  } catch {
    return false;
  }
}

/** Posición del agujero en unidades de dibujo. */
export function pointXY(id: string): { x: number; y: number } {
  const point = parsePoint(id);
  return {
    x: BOARD.x0 + point.column - 1,
    y: point.kind === "rail" ? RAIL_Y[point.rail] : LETTER_Y[point.letter],
  };
}

/**
 * Identificador de la tira metálica interna a la que pertenece un agujero.
 * Dos agujeros con la misma tira están unidos por dentro de la protoboard.
 * Con `splitRails`, cada riel se trata como dos mitades independientes (caso más exigente).
 */
export function stripOf(id: string, splitRails = false): string {
  const point = parsePoint(id);
  if (point.kind === "rail") {
    if (!splitRails) return point.rail;
    return `${point.rail}:${point.column <= RAIL_SPLIT_AFTER ? "L" : "R"}`;
  }
  return `${point.half === "lower" ? "L" : "U"}${point.column}`;
}

/** Todos los agujeros de una tira (para iluminarla al explicar la protoboard). */
export function holesOfStrip(strip: string): PointId[] {
  const central = /^([LU])(\d+)$/.exec(strip);
  if (central) {
    const letters = central[1] === "L" ? LETTERS.slice(0, 5) : LETTERS.slice(5);
    return letters.map((letter) => `${letter}${Number(central[2])}` as HoleId);
  }
  const [rail, half] = strip.split(":") as [RailName, "L" | "R" | undefined];
  return RAIL_COLUMNS.filter((column) =>
    half === undefined
      ? true
      : half === "L"
        ? column <= RAIL_SPLIT_AFTER
        : column > RAIL_SPLIT_AFTER,
  ).map((column) => `${rail}:${column}` as RailId);
}

/** Texto para instrucciones: "agujero a4" o "riel azul (−) de abajo, frente al número 27". */
export function describePoint(id: string): string {
  const point = parsePoint(id);
  return point.kind === "rail"
    ? `${RAIL_INFO[point.rail].label}, frente al número ${point.column}`
    : `agujero ${point.letter}${point.column}`;
}

/** Etiqueta corta para chips y rótulos del diagrama: "a4" o "− 27". */
export function shortPoint(id: string): string {
  const point = parsePoint(id);
  return point.kind === "rail"
    ? `${RAIL_INFO[point.rail].sign} ${point.column}`
    : `${point.letter}${point.column}`;
}

export function letterY(letter: Letter) {
  return LETTER_Y[letter];
}
export function railY(rail: RailName) {
  return RAIL_Y[rail];
}
