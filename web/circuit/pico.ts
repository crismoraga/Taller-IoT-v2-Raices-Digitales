import type { HoleId } from "./breadboard";

/**
 * Raspberry Pi Pico W montada en la protoboard: USB hacia la izquierda, pines 1–20 en la
 * letra c (números 1–20) y pines 40–21 en la letra h (números 1–20).
 * Agujeros libres junto a cada pin: a y b (pines 1–20), i y j (pines 21–40).
 * Las letras d, e, f y g quedan tapadas por la placa.
 */

export type PinKind = "gpio" | "adc" | "gnd" | "power" | "control";

export interface PicoPin {
  /** Número físico 1–40, contado desde el USB. */
  physical: number;
  /** Nombre impreso: GP2, GND, 3V3, VBUS… */
  name: string;
  kind: PinKind;
  /** Número del GPIO si es un pin programable. */
  gpio?: number;
  /** Canal del conversor analógico. */
  adc?: number;
  /** Número de la protoboard donde queda el pin. */
  column: number;
  side: "bottom" | "top";
  /** Agujero que ocupa el pin. */
  hole: HoleId;
  /** Agujeros libres de la misma tira, del más lejano a la placa al más cercano. */
  free: [HoleId, HoleId];
  /** Qué es, en una frase para principiantes. */
  role: string;
  voltage: string;
  warning?: string;
}

const NAMES = [
  "GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7",
  "GP8", "GP9", "GND", "GP10", "GP11", "GP12", "GP13", "GND", "GP14", "GP15",
  "GP16", "GP17", "GND", "GP18", "GP19", "GP20", "GP21", "GND", "GP22", "RUN",
  "GP26", "GP27", "AGND", "GP28", "ADC_VREF", "3V3", "3V3_EN", "GND", "VSYS", "VBUS",
] as const;

/** Uso de cada pin en la estación de planta (mapa canónico del taller). */
export const STATION_ROLE: Record<string, string> = {
  GP2: "LED externo",
  GP3: "Buzzer",
  GP4: "Pulsador (actividad individual)",
  GP14: "Lluvia · DO del módulo LM393",
  GP15: "DHT11 · DATA",
  GP16: "DS18B20 · DATA (1-Wire)",
  GP17: "HC-SR04 · TRIG",
  GP18: "HC-SR04 · ECHO (con divisor)",
  GP19: "PIR HC-SR501 · OUT",
  GP26: "Humedad de suelo · ADC0",
  GP27: "LDR, luz · ADC1",
  GP28: "Nivel de agua · ADC2",
};

function describe(name: string): Pick<PicoPin, "kind" | "role" | "voltage" | "warning"> {
  if (name === "GND" || name === "AGND")
    return {
      kind: "gnd",
      role:
        name === "AGND"
          ? "Tierra de las entradas analógicas. Está unida a los demás GND."
          : "Tierra: el punto de 0 V. Todos los GND de la placa están unidos entre sí.",
      voltage: "0 V",
    };
  if (name === "3V3")
    return {
      kind: "power",
      role: "Salida de 3,3 V para alimentar sensores. Es la alimentación normal del taller.",
      voltage: "3,3 V (salida)",
      warning: "No la unas directo a GND: es un cortocircuito.",
    };
  if (name === "VBUS")
    return {
      kind: "power",
      role: "Los 5 V que llegan por el cable USB. Solo para módulos que piden 5 V (HC-SR04, PIR, LM35).",
      voltage: "5 V (solo con USB conectado)",
      warning:
        "5 V nunca va directo a un pin GP: los GPIO de la Pico trabajan a 3,3 V.",
    };
  if (name === "VSYS")
    return {
      kind: "power",
      role: "Entrada de alimentación del sistema (baterías). No se usa en el taller.",
      voltage: "1,8 a 5,5 V (entrada)",
      warning: "No conectes nada aquí durante el taller.",
    };
  if (name === "3V3_EN")
    return {
      kind: "control",
      role: "Enciende o apaga el regulador de 3,3 V. No se usa en el taller.",
      voltage: "Control",
      warning: "Si lo llevas a GND, la placa se apaga.",
    };
  if (name === "RUN")
    return {
      kind: "control",
      role: "Reinicia la placa si se lleva a GND. No se usa en el taller.",
      voltage: "Control",
    };
  if (name === "ADC_VREF")
    return {
      kind: "control",
      role: "Referencia de voltaje del conversor analógico. No se usa en el taller.",
      voltage: "3,3 V (referencia)",
    };
  const gpio = Number(name.slice(2));
  if (gpio >= 26)
    return {
      kind: "adc",
      role: `Entrada analógica ADC${gpio - 26}: mide un voltaje entre 0 y 3,3 V y lo convierte en un número. También sirve como pin digital.`,
      voltage: "0 a 3,3 V",
      warning: "Nunca más de 3,3 V en este pin.",
    };
  return {
    kind: "gpio",
    role: "Pin digital programable: puede ser salida (enciende o apaga algo) o entrada (lee un 0 o un 1).",
    voltage: "0 V o 3,3 V",
    warning: "Nunca más de 3,3 V en este pin.",
  };
}

export const PICO_PINS: PicoPin[] = NAMES.map((name, index) => {
  const physical = index + 1;
  const bottom = physical <= 20;
  const column = bottom ? physical : 41 - physical;
  const gpio = /^GP\d+$/.test(name) ? Number(name.slice(2)) : undefined;
  return {
    physical,
    name,
    gpio,
    adc: gpio !== undefined && gpio >= 26 ? gpio - 26 : undefined,
    column,
    side: bottom ? "bottom" : "top",
    hole: `${bottom ? "c" : "h"}${column}` as HoleId,
    free: (bottom
      ? [`a${column}`, `b${column}`]
      : [`j${column}`, `i${column}`]) as [HoleId, HoleId],
    ...describe(name),
  };
});

export const PICO_COLUMNS = 20;

const byName = new Map<string, PicoPin[]>();
for (const pin of PICO_PINS)
  byName.set(pin.name, [...(byName.get(pin.name) ?? []), pin]);

/** Busca por nombre impreso ("GP2", "3V3", "VBUS"). Para GND usa `picoPinAt`. */
export function picoPin(name: string): PicoPin {
  const found = byName.get(name);
  if (!found) throw new Error(`La Pico W no tiene un pin llamado ${name}.`);
  if (found.length > 1)
    throw new Error(`${name} aparece en varios pines; indica el número físico.`);
  return found[0];
}
export function picoPinAt(physical: number): PicoPin {
  const pin = PICO_PINS[physical - 1];
  if (!pin) throw new Error(`La Pico W no tiene pin físico ${physical}.`);
  return pin;
}
/** Pin de la Pico cuya tira contiene este agujero, si lo hay. */
export function picoPinForStrip(strip: string): PicoPin | undefined {
  const match = /^([LU])(\d+)$/.exec(strip);
  if (!match) return undefined;
  const column = Number(match[2]);
  if (column > PICO_COLUMNS) return undefined;
  return PICO_PINS.find(
    (pin) => pin.column === column && pin.side === (match[1] === "L" ? "bottom" : "top"),
  );
}
/** "GP2 (pin 4)" — nombre y número físico juntos, como en todas las instrucciones. */
export function pinLabel(pin: PicoPin): string {
  return `${pin.name} (pin ${pin.physical})`;
}
