import { isPoint, parsePoint, pointXY, stripOf } from "./breadboard";
import type { Circuit, PartInstance } from "./model";
import { LED_VF, partDef } from "./parts";
import { PICO_COLUMNS, PICO_PINS, type PicoPin } from "./pico";

/**
 * Revisión eléctrica de un montaje (ERC). Calcula qué queda unido con qué según las tiras
 * internas de la protoboard, los cables y las piezas, y comprueba:
 *   1. que cada agujero y cada pin exista y se use una sola vez;
 *   2. que no haya cortocircuitos entre 3V3, 5 V y GND;
 *   3. que ningún pin GP reciba más de 3,3 V (resuelve los divisores resistivos);
 *   4. que cada LED tenga su resistencia y una corriente segura para el pin;
 *   5. que cada módulo reciba la alimentación que admite;
 *   6. que las uniones físicas sean exactamente las del netlist esperado.
 * Se ejecuta en los tests para cada lección y para la estación completa.
 */

export interface Issue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface Analysis {
  issues: Issue[];
  /** Terminal → identificador de nodo eléctrico. */
  netOf: (terminal: string) => string | undefined;
  /** Voltaje máximo esperado en cada pin GP conectado, en voltios. */
  gpioVolts: Record<string, number>;
  /** Corriente estimada de cada LED, en mA. */
  ledMilliamps: Record<string, number>;
  /** Terminales agrupados por nodo. */
  nets: string[][];
}

export interface AnalyzeOptions {
  /** Trata cada riel como dos mitades sin unir (protoboards con el riel cortado al centro). */
  splitRails?: boolean;
  /** Voltaje del USB a considerar. 5,25 V es el máximo de la norma. */
  vbus?: number;
}

/** Separación admisible entre las dos patas de cada pieza, en pasos de la protoboard. */
const SPAN: Partial<Record<PartInstance["type"], [number, number]>> = {
  resistor: [3, 8],
  led: [1, 1.5],
  ldr: [1, 3],
  buzzer: [2, 4],
  tilt: [1, 3],
};
const GPIO_ABS_MAX = 3.6;
const GPIO_SAFE_MA = 12;

class Union {
  private parent = new Map<string, string>();
  find(key: string): string {
    if (!this.parent.has(key)) this.parent.set(key, key);
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cursor = key;
    while (this.parent.get(cursor) !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }
  join(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
  keys() {
    return [...this.parent.keys()];
  }
}

/** Nombre del terminal de un pin de la Pico. Todos los GND son un mismo terminal. */
export function picoTerminal(pin: PicoPin): string {
  return pin.kind === "gnd" ? "pico:GND" : `pico:${pin.name}`;
}

const stripKey = (strip: string) => `strip:${strip}`;

export function analyze(circuit: Circuit, options: AnalyzeOptions = {}): Analysis {
  const { splitRails = false, vbus = 5 } = options;
  const issues: Issue[] = [];
  const error = (code: string, message: string) =>
    issues.push({ level: "error", code, message });
  const warning = (code: string, message: string) =>
    issues.push({ level: "warning", code, message });
  const union = new Union();
  const parts = new Map<string, PartInstance>();
  const occupied = new Map<string, string>();

  const node = (endpoint: string): string | null => {
    if (isPoint(endpoint)) return stripKey(stripOf(endpoint, splitRails));
    const [partId, pinId] = endpoint.split(".");
    const part = parts.get(partId);
    if (!part) {
      error("unknown-part", `El terminal "${endpoint}" nombra una pieza que no existe.`);
      return null;
    }
    if (!partDef(part).pins.some((pin) => pin.id === pinId)) {
      error("unknown-pin", `${part.label} no tiene un pin "${pinId}".`);
      return null;
    }
    return `pin:${endpoint}`;
  };

  const occupy = (hole: string, by: string) => {
    let parsed;
    try {
      parsed = parsePoint(hole);
    } catch (problem) {
      error("bad-hole", (problem as Error).message);
      return false;
    }
    if (parsed.kind === "hole" && parsed.column <= PICO_COLUMNS) {
      if (parsed.letter === "c" || parsed.letter === "h") {
        error("pico-pin", `${hole} lo ocupa un pin de la Pico; ${by} debe usar un agujero libre de esa tira.`);
        return false;
      }
      if ("defg".includes(parsed.letter)) {
        error("under-pico", `${hole} queda tapado por la Pico; ${by} no puede ir ahí.`);
        return false;
      }
    }
    const previous = occupied.get(hole);
    if (previous) {
      error("hole-in-use", `El agujero ${hole} lo usan a la vez ${previous} y ${by}.`);
      return false;
    }
    occupied.set(hole, by);
    return true;
  };

  // La Pico: cada pin unido a su tira; todos los GND unidos por dentro de la placa.
  for (const pin of PICO_PINS) {
    union.join(`pin:${picoTerminal(pin)}`, stripKey(stripOf(pin.hole, splitRails)));
  }

  for (const part of circuit.parts) {
    if (parts.has(part.id)) error("duplicate-part", `Hay dos piezas con el id "${part.id}".`);
    parts.set(part.id, part);
    const def = partDef(part);
    for (const pin of def.pins) union.find(`pin:${part.id}.${pin.id}`);
    if (part.holes) {
      for (const [pinId, hole] of Object.entries(part.holes)) {
        if (!def.pins.some((pin) => pin.id === pinId)) {
          error("unknown-pin", `${part.label} no tiene un pin "${pinId}".`);
          continue;
        }
        if (occupy(hole, `${part.label} (${pinId})`))
          union.join(`pin:${part.id}.${pinId}`, stripKey(stripOf(hole, splitRails)));
      }
      if (def.mount === "board") {
        for (const pin of def.pins)
          if (!(pin.id in part.holes))
            error("pin-not-placed", `${part.label}: falta indicar el agujero de "${pin.label}".`);
      }
    } else if (def.mount === "board") {
      error("not-placed", `${part.label} va en la protoboard y no tiene agujeros asignados.`);
    }
    if (def.model.kind === "switch")
      for (const [a, b] of def.model.joined)
        union.join(`pin:${part.id}.${a}`, `pin:${part.id}.${b}`);
    // ¿Las patas alcanzan? Distancia entre agujeros en pasos de 2,54 mm.
    const reach = SPAN[part.type];
    if (reach && part.holes) {
      const [first, second] = Object.values(part.holes);
      try {
        const a = pointXY(first);
        const b = pointXY(second);
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < reach[0] || distance > reach[1])
          error(
            "part-span",
            `${part.label}: sus patas no calzan entre ${first} y ${second} (separación de ${distance.toFixed(1)} pasos; admite ${reach[0]}–${reach[1]}).`,
          );
      } catch {
        /* El agujero inválido ya quedó informado. */
      }
    }
  }

  const wireIds = new Set<string>();
  for (const wire of circuit.wires) {
    if (wireIds.has(wire.id)) error("duplicate-wire", `Hay dos cables con el id "${wire.id}".`);
    wireIds.add(wire.id);
    const ends = [wire.from, wire.to].map((endpoint) => {
      if (isPoint(endpoint))
        return occupy(endpoint, `el cable ${wire.color} (${wire.carries})`) ? node(endpoint) : null;
      return node(endpoint);
    });
    if (ends[0] && ends[1]) {
      // Los puentes de riel son redundantes a propósito cuando el riel no viene cortado.
      const bridge =
        isPoint(wire.from) &&
        isPoint(wire.to) &&
        stripOf(wire.from) === stripOf(wire.to) &&
        parsePoint(wire.from).kind === "rail";
      if (union.find(ends[0]) === union.find(ends[1]) && !bridge)
        warning("redundant-wire", `El cable ${wire.id} une dos puntos que ya estaban unidos.`);
      union.join(ends[0], ends[1]);
    }
    if (wire.kind === "jumper" && (!isPoint(wire.from) || !isPoint(wire.to)))
      error("jumper-ends", `El cable ${wire.id} es macho-macho: sus dos puntas van en agujeros.`);
  }

  // Pasos: cada pieza y cable se coloca exactamente en un paso.
  const placed = new Map<string, string>();
  for (const step of circuit.steps) {
    for (const id of [...(step.parts ?? []), ...(step.wires ?? [])]) {
      if (!parts.has(id) && !wireIds.has(id))
        error("step-unknown", `El paso "${step.id}" nombra "${id}", que no existe.`);
      if (placed.has(id))
        error("step-twice", `"${id}" se coloca en dos pasos: ${placed.get(id)} y ${step.id}.`);
      placed.set(id, step.id);
    }
  }
  for (const id of [...parts.keys(), ...wireIds])
    if (!placed.has(id)) error("step-missing", `Ningún paso indica cuándo colocar "${id}".`);

  const netOf = (terminal: string) => {
    const key = `pin:${terminal}`;
    return union.keys().includes(key) ? union.find(key) : undefined;
  };

  /* ── Nodos de alimentación y cortocircuitos ─────────────────── */
  const gnd = union.find("pin:pico:GND");
  const v33 = union.find("pin:pico:3V3");
  const v5 = union.find("pin:pico:VBUS");
  const fixed = new Map<string, number>([
    [gnd, 0],
    [v33, 3.3],
    [v5, vbus],
  ]);
  if (gnd === v33) error("short", "Cortocircuito: 3V3 quedó unido directamente con GND.");
  if (gnd === v5) error("short", "Cortocircuito: VBUS (5 V) quedó unido directamente con GND.");
  if (v33 === v5) error("short", "3V3 y VBUS (5 V) quedaron unidos: nunca deben tocarse.");
  for (const name of ["VSYS", "3V3_EN", "RUN", "ADC_VREF"]) {
    const net = union.find(`pin:pico:${name}`);
    if (union.keys().some((key) => key !== `pin:pico:${name}` && key.startsWith("pin:") && union.find(key) === net))
      error("reserved-pin", `El pin ${name} de la Pico no se usa en el taller y quedó conectado.`);
  }

  /* ── Red resistiva: fuentes, resistencias y voltajes ────────── */
  type Edge = { a: string; b: string; ohms: number; id: string };
  const edges: Edge[] = [];
  const leds: { id: string; anode: string; cathode: string; vf: number; label: string }[] = [];
  for (const part of circuit.parts) {
    const def = partDef(part);
    const net = (pin: string) => union.find(`pin:${part.id}.${pin}`);
    if (def.model.kind === "resistor") {
      const ohms = part.props?.ohms;
      if (!ohms) {
        error("resistor-value", `${part.label}: falta su valor en ohmios.`);
        continue;
      }
      if (net("a") === net("b"))
        error("shorted-part", `${part.label}: sus dos patas quedaron en la misma tira; no hace nada.`);
      edges.push({ a: net("a"), b: net("b"), ohms, id: part.id });
    } else if (def.model.kind === "led") {
      if (net("anodo") === net("catodo"))
        error("shorted-part", `${part.label}: sus dos patas quedaron en la misma tira.`);
      leds.push({
        id: part.id,
        anode: net("anodo"),
        cathode: net("catodo"),
        vf: part.props?.vf ?? LED_VF[part.props?.color ?? "rojo"],
        label: part.label,
      });
    } else if (def.model.kind === "variable") {
      const [a, b] = def.model.between;
      if (net(a) === net(b))
        error("shorted-part", `${part.label}: sus patas quedaron en la misma tira.`);
      // Peor caso para el voltaje: la resistencia variable en su valor más bajo.
      else edges.push({ a: net(a), b: net(b), ohms: 100, id: `${part.id}:min` });
    } else if (def.model.kind === "switch") {
      const [[a], [b]] = def.model.joined;
      if (net(a) === net(b))
        error("shorted-part", `${part.label}: quedó siempre cerrado; gíralo o usa patas en diagonal.`);
    } else if (def.model.kind === "active") {
      const model = def.model;
      const supplyNet = net(model.vcc);
      const supply = fixed.get(supplyNet);
      if (net(model.gnd) !== gnd)
        error("module-gnd", `${part.label}: su pin ${model.gnd} no llega a GND.`);
      if (supply === undefined || supply === 0) {
        error("module-power", `${part.label}: su pin ${model.vcc} no llega a 3V3 ni a 5 V.`);
        continue;
      }
      const nominal = supply === vbus ? 5 : supply;
      if (!model.supply.includes(nominal))
        error(
          "module-supply",
          `${part.label} se alimenta con ${model.supply.join(" o ")} V y quedó conectado a ${nominal} V.`,
        );
      for (const [pin, level] of Object.entries(model.outputs)) {
        const outNet = net(pin);
        if (level === "open") continue;
        if (level === "pullup") {
          // Colector abierto con resistencia interna a su alimentación.
          edges.push({ a: outNet, b: supplyNet, ohms: 10000, id: `${part.id}.${pin}:pullup` });
          continue;
        }
        const volts = level === "vcc" ? supply : level;
        const existing = fixed.get(outNet);
        if (existing === undefined) fixed.set(outNet, volts);
        else if (outNet === gnd || outNet === v33 || outNet === v5)
          error("output-short", `${part.label}: su salida ${pin} quedó unida a una línea de alimentación.`);
      }
    }
  }

  const volts = solve(edges, fixed);

  const gpioVolts: Record<string, number> = {};
  for (const pin of PICO_PINS) {
    if (pin.kind !== "gpio" && pin.kind !== "adc") continue;
    const net = union.find(`pin:pico:${pin.name}`);
    const alone = !union
      .keys()
      .some((key) => key !== `pin:pico:${pin.name}` && key.startsWith("pin:") && union.find(key) === net) &&
      !edges.some((edge) => edge.a === net || edge.b === net);
    if (alone) continue;
    if (net === gnd)
      error("gpio-gnd", `${pin.name} quedó unido directo a GND: si el programa lo pone en 1 hay un cortocircuito.`);
    if (net === v33)
      error("gpio-3v3", `${pin.name} quedó unido directo a 3V3: si el programa lo pone en 0 hay un cortocircuito.`);
    const value = volts.get(net);
    if (value === undefined) continue;
    gpioVolts[pin.name] = Math.round(value * 100) / 100;
    if (value > GPIO_ABS_MAX)
      error(
        "gpio-overvoltage",
        `${pin.name} recibiría ${value.toFixed(2).replace(".", ",")} V. Los pines de la Pico soportan 3,3 V: falta un divisor de voltaje.`,
      );
  }

  /* ── LED: resistencia en serie y corriente ──────────────────── */
  const ledMilliamps: Record<string, number> = {};
  const sources = new Map<string, number>();
  for (const pin of PICO_PINS)
    if (pin.kind === "gpio" || pin.kind === "adc")
      sources.set(union.find(`pin:pico:${pin.name}`), 3.3);
  sources.set(v33, 3.3);
  sources.set(v5, vbus);
  for (const led of leds) {
    const up = nearest(led.anode, edges, (net) => sources.has(net) && net !== gnd);
    const down = nearest(led.cathode, edges, (net) => net === gnd);
    if (!up || !down) continue;
    const series = up.ohms + down.ohms;
    const supply = sources.get(up.net)!;
    if (series < 68) {
      error("led-no-resistor", `${led.label} no tiene resistencia en serie: se quemaría o dañaría el pin.`);
      continue;
    }
    const milliamps = Math.max(0, ((supply - led.vf) / series) * 1000);
    ledMilliamps[led.id] = Math.round(milliamps * 10) / 10;
    if (milliamps > GPIO_SAFE_MA)
      error(
        "led-current",
        `${led.label} pediría ${milliamps.toFixed(1)} mA, más de lo seguro para un pin (${GPIO_SAFE_MA} mA).`,
      );
  }

  /* ── Netlist esperado: ni más ni menos uniones ──────────────── */
  const universe = new Set<string>();
  for (const pin of PICO_PINS) universe.add(picoTerminal(pin));
  for (const part of circuit.parts)
    for (const pin of partDef(part).pins) universe.add(`${part.id}.${pin.id}`);
  const expected = new Map<string, number>();
  circuit.nets.forEach((group, index) => {
    for (const terminal of group) {
      if (!universe.has(terminal))
        error("net-unknown", `El netlist nombra "${terminal}", que no existe en el montaje.`);
      if (expected.has(terminal) && expected.get(terminal) !== index)
        error("net-twice", `"${terminal}" aparece en dos grupos del netlist.`);
      expected.set(terminal, index);
    }
  });
  const physical = new Map<string, string[]>();
  for (const terminal of universe) {
    const net = union.find(`pin:${terminal}`);
    physical.set(net, [...(physical.get(net) ?? []), terminal]);
  }
  for (const group of circuit.nets) {
    const [first, ...rest] = group;
    for (const terminal of rest)
      if (union.find(`pin:${first}`) !== union.find(`pin:${terminal}`))
        error("net-open", `Falta una conexión: ${pretty(first)} debería llegar a ${pretty(terminal)}.`);
  }
  for (const members of physical.values()) {
    if (members.length < 2) continue;
    const groups = new Set(members.map((terminal) => expected.get(terminal) ?? `solo:${terminal}`));
    if (groups.size > 1) {
      const [a, b] = members.filter(
        (terminal, index, all) =>
          all.findIndex(
            (other) => (expected.get(other) ?? `solo:${other}`) === (expected.get(terminal) ?? `solo:${terminal}`),
          ) === index,
      );
      error("net-bridge", `Unión que no debería existir: ${pretty(a)} quedó conectado con ${pretty(b)}.`);
    }
  }

  return {
    issues,
    netOf,
    gpioVolts,
    ledMilliamps,
    nets: [...physical.values()].filter((members) => members.length > 1),
  };
}

function pretty(terminal: string) {
  return terminal.startsWith("pico:") ? `${terminal.slice(5)} de la Pico` : terminal;
}

/**
 * Análisis nodal de una red de resistencias con algunos nodos a voltaje fijo.
 * Devuelve el voltaje de cada nodo alcanzable; los nodos aislados no aparecen.
 */
function solve(
  edges: { a: string; b: string; ohms: number }[],
  fixed: Map<string, number>,
): Map<string, number> {
  const result = new Map(fixed);
  const unknown = [
    ...new Set(edges.flatMap((edge) => [edge.a, edge.b]).filter((net) => !fixed.has(net))),
  ];
  // Solo se resuelven los nodos con algún camino hasta una fuente.
  const reachable = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of edges) {
      const aKnown = fixed.has(edge.a) || reachable.has(edge.a);
      const bKnown = fixed.has(edge.b) || reachable.has(edge.b);
      if (aKnown && !bKnown && !fixed.has(edge.b)) {
        reachable.add(edge.b);
        grew = true;
      }
      if (bKnown && !aKnown && !fixed.has(edge.a)) {
        reachable.add(edge.a);
        grew = true;
      }
    }
  }
  const nodes = unknown.filter((net) => reachable.has(net));
  const size = nodes.length;
  if (!size) return result;
  const index = new Map(nodes.map((net, position) => [net, position]));
  const matrix = Array.from({ length: size }, () => new Array<number>(size + 1).fill(0));
  for (const edge of edges) {
    const conductance = 1 / edge.ohms;
    for (const [self, other] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ]) {
      const row = index.get(self);
      if (row === undefined) continue;
      const column = index.get(other);
      if (column !== undefined) {
        matrix[row][row] += conductance;
        matrix[row][column] -= conductance;
      } else if (fixed.has(other)) {
        matrix[row][row] += conductance;
        matrix[row][size] += conductance * fixed.get(other)!;
      }
    }
  }
  for (let pivot = 0; pivot < size; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row++)
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[best][pivot])) best = row;
    if (Math.abs(matrix[best][pivot]) < 1e-15) continue;
    [matrix[pivot], matrix[best]] = [matrix[best], matrix[pivot]];
    for (let row = 0; row < size; row++) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot] / matrix[pivot][pivot];
      if (!factor) continue;
      for (let column = pivot; column <= size; column++)
        matrix[row][column] -= factor * matrix[pivot][column];
    }
  }
  nodes.forEach((net, position) => {
    const diagonal = matrix[position][position];
    if (Math.abs(diagonal) > 1e-15) result.set(net, matrix[position][size] / diagonal);
  });
  return result;
}

/** Camino de menor resistencia desde un nodo hasta el primero que cumpla la condición. */
function nearest(
  start: string,
  edges: { a: string; b: string; ohms: number }[],
  accept: (net: string) => boolean,
): { net: string; ohms: number } | null {
  const distance = new Map<string, number>([[start, 0]]);
  const pending = new Set<string>([start]);
  while (pending.size) {
    let current = "";
    let smallest = Infinity;
    for (const net of pending)
      if (distance.get(net)! < smallest) {
        smallest = distance.get(net)!;
        current = net;
      }
    pending.delete(current);
    if (accept(current)) return { net: current, ohms: smallest };
    for (const edge of edges) {
      const next = edge.a === current ? edge.b : edge.b === current ? edge.a : null;
      if (!next) continue;
      const total = smallest + edge.ohms;
      if (total < (distance.get(next) ?? Infinity)) {
        distance.set(next, total);
        pending.add(next);
      }
    }
  }
  return null;
}
