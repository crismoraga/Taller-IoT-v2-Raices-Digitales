import { BOARD_NAMES, type Board } from "../lib/context";
import { isPoint, describePoint, stripOf } from "./breadboard";
import { picoPinForStrip } from "./pico";
import { mergeGroups, type Circuit, type Endpoint } from "./model";

export interface ControllerPin {
  name: string;
  label: string;
  x: number;
  y: number;
  kind: "gpio" | "adc" | "gnd" | "power" | "control";
}

/** Headers vistos desde arriba, USB a la izquierda. Uno y Nano se dibujan
 * junto a la protoboard: ningún agujero se presenta como un pin de otra placa. */
export function controllerBox(board: Board = "pico") {
  return board === "uno"
    ? { x: -28, y: -1, w: 27, h: 20.7 }
    : { x: -22, y: 4.5, w: 17, h: 7.1 };
}

const kind = (name: string): ControllerPin["kind"] =>
  name.startsWith("GND")
    ? "gnd"
    : /^D\d+$/.test(name)
      ? "gpio"
      : /^A\d+$/.test(name)
        ? "adc"
        : ["3V3", "5V", "VIN"].includes(name)
          ? "power"
          : "control";

export function controllerPins(board: Board = "pico"): ControllerPin[] {
  if (board === "pico") return [];
  const box = controllerBox(board);
  const pin = (name: string, x: number, y: number): ControllerPin => ({
    name,
    label: name.startsWith("GND") ? "GND" : name,
    x: box.x + x,
    y: box.y + y,
    kind: kind(name),
  });
  if (board === "uno") {
    // UNO Rev3: digital header D0–D7; D8–D13/GND/AREF; power and A0–A5.
    return [
      ...Array.from({ length: 8 }, (_, i) => pin(`D${i}`, 24 - i, 1.1)),
      ...Array.from({ length: 6 }, (_, i) => pin(`D${i + 8}`, 15.5 - i, 1.1)),
      pin("GND3", 9.5, 1.1),
      pin("AREF", 8.5, 1.1),
      pin("SDA", 7.5, 1.1),
      pin("SCL", 6.5, 1.1),
      ...["IOREF", "RESET", "3V3", "5V", "GND", "GND2", "VIN"].map((name, i) =>
        pin(name, 7 + i, 18.5),
      ),
      ...Array.from({ length: 6 }, (_, i) => pin(`A${i}`, 16 + i, 18.5)),
    ];
  }
  // Classic ATmega328P/ATmega168 Nano (not Nano Every / RP2040 / ESP32).
  return [
    ...[
      "D12",
      "D11",
      "D10",
      "D9",
      "D8",
      "D7",
      "D6",
      "D5",
      "D4",
      "D3",
      "D2",
      "GND",
      "RESET",
      "D0",
      "D1",
    ].map((name, i) => pin(name, 1 + i, 0.6)),
    ...[
      "D13",
      "3V3",
      "AREF",
      "A0",
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
      "A7",
      "5V",
      "RESET2",
      "GND2",
      "VIN",
    ].map((name, i) => pin(name, 1 + i, 6.5)),
  ];
}

export function controllerPin(
  board: Board | undefined,
  name: string,
): ControllerPin {
  const found = controllerPins(board).find((pin) => pin.name === name);
  if (!found)
    throw new Error(`La placa ${board ?? "pico"} no tiene el pin ${name}.`);
  return found;
}

export function controllerTerminal(name: string): string {
  if (name.startsWith("GND")) return "controller:GND";
  if (name === "SDA") return "controller:A4";
  if (name === "SCL") return "controller:A5";
  if (name === "RESET2") return "controller:RESET";
  return `controller:${name}`;
}

/** Mapa canónico idéntico a firmware/arduino/station.ino y los sketches de actividad. */
export const ARDUINO_STATION_PINS: Record<string, string> = {
  GP2: "D2",
  GP3: "D3",
  GP4: "D4",
  GP14: "D6",
  GP15: "D4",
  GP16: "D5",
  GP17: "D7",
  GP18: "D8",
  GP19: "D9",
  GP26: "A0",
  GP27: "A1",
  GP28: "A2",
  "3V3": "3V3",
  VBUS: "5V",
  GND: "GND",
  AGND: "GND",
};

export function describeEndpoint(circuit: Circuit, endpoint: string): string {
  if (isPoint(endpoint)) return describePoint(endpoint);
  const [id, name] = endpoint.split(".");
  if (id === "controller")
    return `pin ${controllerPin(circuit.board, name).label} de ${BOARD_NAMES[circuit.board ?? "pico"]}`;
  return `pin ${name} de ${circuit.parts.find((part) => part.id === id)?.label ?? id}`;
}

/** Conserva las coordenadas de componentes y rieles. Cambia únicamente los
 * terminales que realmente llegan a la placa y la etapa ECHO que exige cada MCU. */
export function circuitForBoard(source: Circuit, board: Board): Circuit {
  if (board === "pico") return source;
  const potentiometer = source.id === "potentiometer";
  const dhtParts = source.parts.filter((part) => part.type === "dht11");
  const dhtSupply = new Set(dhtParts.map((part) => `${part.id}.VCC`));
  const shared5V = source.nets.some((net) => net.includes("pico:VBUS"));
  const plantProfile = source.id.startsWith("plant_station-");
  const hasRain = source.parts.some((part) => part.type === "rain");
  const hasOther3V3 = source.parts.some((part) =>
    ["ldr", "soil", "ds18b20", "rain", "water"].includes(part.type),
  );
  // KY-015 uses 5 V on AVR. Keep the analog sensors' existing 3V3 rails:
  // a single/basic DHT plugs into 5V; the expanded kit shares the free g1 hole.
  const unusedPowerWires = new Set(
    dhtParts.length && plantProfile
      ? [
          ...(!hasOther3V3 ? ["w_3v3_top"] : []),
          ...(!hasRain ? ["w_3v3_bottom"] : []),
          "w_bridge_bp",
        ]
      : dhtParts.length && source.id === "dht11"
        ? ["w_3v3_top", "w_3v3_bottom", "w_bridge_bp"]
        : dhtParts.length && source.id === "station_basic"
          ? ["w_3v3_bottom", "w_bridge_bp"]
          : [],
  );
  const mapPin = (name: string) => {
    const mapped = ARDUINO_STATION_PINS[name];
    if (!mapped)
      throw new Error(`No hay correspondencia Arduino para ${name}.`);
    return potentiometer && mapped === "3V3" ? "5V" : mapped;
  };
  const mapEndpoint = (endpoint: Endpoint): Endpoint => {
    if (!isPoint(endpoint)) return endpoint;
    const pin = picoPinForStrip(stripOf(endpoint));
    if (!pin) return endpoint;
    // UNO/Nano have one 5 V connector. A dedicated breadboard strip distributes
    // it to several modules instead of drawing multiple plugs in one socket.
    if (pin.name === "VBUS") return endpoint;
    const mapped =
      pin.kind === "gnd" && pin.side === "top" ? "GND2" : mapPin(pin.name);
    return `controller.${mapped}`;
  };
  const hasEcho = source.parts.some((part) => part.id === "hc");
  const removed = (id: string) =>
    unusedPowerWires.has(id) ||
    (hasEcho && (id.startsWith("r_echo") || id === "w_hc_div_gnd"));
  const parts = source.parts.filter((part) => !removed(part.id));
  const wires = source.wires
    .filter((wire) => !removed(wire.id))
    .map((wire) => ({
      ...wire,
      from: mapEndpoint(wire.id === "w_hc_echo" ? "c59" : wire.from),
      to:
        dhtParts.length && wire.id === "w_dht_3v3"
          ? shared5V
            ? "g1"
            : "controller.5V"
          : mapEndpoint(wire.to),
      kind:
        board !== "uno" &&
        ((dhtParts.length && wire.id === "w_dht_3v3" && !shared5V) ||
          [wire.from, wire.to].some(
            (end) => isPoint(end) && picoPinForStrip(stripOf(end)),
          ))
          ? ("cable" as const)
          : wire.kind,
      color:
        (dhtParts.length && wire.id === "w_dht_3v3") ||
        (potentiometer && wire.carries === "3V3")
          ? ("naranja" as const)
          : wire.color,
      carries:
        dhtParts.length && wire.id === "w_dht_3v3"
          ? "5 V"
          : wire.carries.replace(/GP\d+|3V3|VBUS/g, (name) => mapPin(name)),
    }));
  for (const wire of wires) {
    const female = (end: string) =>
      end.startsWith("controller.") ? board !== "uno" : !isPoint(end);
    const count = Number(female(wire.from)) + Number(female(wire.to));
    Object.assign(wire, {
      connector:
        count === 2
          ? "hembra-hembra"
          : count === 1
            ? "hembra-macho"
            : "macho-macho",
    });
  }
  const circuit: Circuit = {
    ...source,
    board,
    id: `${source.id}-${board}`,
    title: `${source.title.replace(/Pico W/g, board === "uno" ? "Arduino Uno" : "Arduino Nano").replace(/GP\d+/g, (name) => mapPin(name))} · ${board === "uno" ? "Arduino Uno" : "Arduino Nano"}`,
    parts,
    wires,
    steps: [],
    nets: [],
  };
  circuit.steps = source.steps
    .filter(
      (step) =>
        !step.id.startsWith("hc-div-") &&
        !step.wires?.some((id) => unusedPowerWires.has(id)),
    )
    .map((step) => {
      const connected = wires.filter((wire) => step.wires?.includes(wire.id));
      if (!connected.length) return { ...step, warning: undefined };
      const wire = connected[0];
      const a = describeEndpoint(circuit, wire.from),
        b = describeEndpoint(circuit, wire.to);
      return {
        ...step,
        warning: undefined,
        title: `Cable ${wire.color}: de ${a} a ${b}`,
        detail: `${connected.length === 1 ? "Toma un cable" : "Conecta los cables indicados"} ${wire.connector}. Conecta un extremo en ${a} y el otro en ${b}. Transporta ${wire.carries}.`,
        verify: `Conecté ${a} con ${b}.`,
        why: undefined,
        tip: undefined,
      };
    });
  circuit.nets = mergeGroups(
    source.nets
      .map((net) =>
        net
          .filter(
            (terminal) =>
              !terminal.startsWith("r_echo") && !dhtSupply.has(terminal),
          )
          .map((terminal) =>
            terminal.startsWith("pico:")
              ? controllerTerminal(mapPin(terminal.slice(5)))
              : terminal,
          ),
      )
      .filter((net) => net.length > 1),
  );
  if (dhtParts.length)
    circuit.nets = mergeGroups([
      ...circuit.nets,
      ["controller:5V", ...dhtSupply],
    ]);
  if (source.nets.some((net) => net.includes("pico:VBUS"))) {
    circuit.wires.unshift({
      id: "w_controller_5v",
      from: "controller.5V",
      to: "h1",
      color: "naranja",
      kind: board === "uno" ? "jumper" : "cable",
      connector: board === "uno" ? "macho-macho" : "hembra-macho",
      carries: "5 V",
    });
    circuit.steps.unshift({
      id: "controller-5v",
      kind: "wire",
      title: "Cable naranja: del pin 5V a h1",
      detail:
        "Toma un cable naranja. Conecta un extremo al pin 5V de Arduino y el otro al agujero h1: esta tira alimenta los módulos de 5 V.",
      wires: ["w_controller_5v"],
      shared: true,
    });
  }
  if (hasEcho) {
    // ATmega328P measures the native 5 V ECHO directly; no Pico-specific divider.
    circuit.nets = mergeGroups([...circuit.nets, ["hc.ECHO", "controller:D8"]]);
  }
  return circuit;
}
