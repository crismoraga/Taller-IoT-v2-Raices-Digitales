import type { PartInstance, PartType } from "./model";

/**
 * Catálogo de piezas: sus terminales, cómo se montan y su modelo eléctrico para la
 * revisión automática. Los valores eléctricos son los de las hojas de datos habituales;
 * las variantes de cada módulo se confirman con el montaje de prueba del docente.
 */

export interface PinDef {
  id: string;
  /** Marca que el estudiante debe buscar en la pieza. */
  label: string;
  /** Otras marcas frecuentes para el mismo terminal. */
  aka?: string[];
  role: "vcc" | "gnd" | "signal" | "passive";
}

export type ElectricalModel =
  | { kind: "resistor" }
  | { kind: "led" }
  /** Resistencia que cambia con la luz o la posición: no fija voltajes por sí sola. */
  | { kind: "variable"; between: [string, string] }
  /** Contactos unidos por dentro (pulsador): cada par es un mismo nodo. */
  | { kind: "switch"; joined: [string, string][] }
  | { kind: "passive" }
  | {
      kind: "active";
      vcc: string;
      gnd: string;
      /** Voltajes de alimentación admitidos. */
      supply: number[];
      /**
       * Nivel alto máximo de cada salida: "vcc" (igual a la alimentación), un voltaje fijo,
       * o "pullup" (colector abierto con resistencia interna a su alimentación).
       */
      outputs: Record<string, "vcc" | "pullup" | "open" | number>;
    };

export interface PartDef {
  type: PartType;
  name: string;
  /** board: sus patas entran en la protoboard. module: queda fuera y llega con cables. */
  mount: "board" | "module";
  pins: PinDef[];
  model: ElectricalModel;
  /** Qué es y qué hace, para la ficha al seleccionarla. */
  about: string;
  /** Cómo reconocer su orientación. */
  orientation?: string;
}

export const PARTS: Record<Exclude<PartType, "generic">, PartDef> = {
  resistor: {
    type: "resistor",
    name: "Resistencia",
    mount: "board",
    pins: [
      { id: "a", label: "pata 1", role: "passive" },
      { id: "b", label: "pata 2", role: "passive" },
    ],
    model: { kind: "resistor" },
    about:
      "Limita la corriente o reparte un voltaje. No tiene polaridad: puedes ponerla en cualquier sentido.",
    orientation: "Su valor se lee en las bandas de color.",
  },
  led: {
    type: "led",
    name: "LED de 5 mm",
    mount: "board",
    pins: [
      { id: "anodo", label: "ánodo (+)", aka: ["pata larga"], role: "passive" },
      { id: "catodo", label: "cátodo (−)", aka: ["pata corta", "lado plano"], role: "passive" },
    ],
    model: { kind: "led" },
    about:
      "Diodo que emite luz. Solo conduce en un sentido y siempre necesita una resistencia que limite su corriente.",
    orientation:
      "La pata larga es el ánodo (+). La pata corta, junto al borde plano de la cápsula, es el cátodo (−).",
  },
  ldr: {
    type: "ldr",
    name: "Fotorresistencia LDR 5549",
    mount: "board",
    pins: [
      { id: "a", label: "pata 1", role: "passive" },
      { id: "b", label: "pata 2", role: "passive" },
    ],
    model: { kind: "variable", between: ["a", "b"] },
    about:
      "Resistencia que baja cuando recibe más luz. Con otra resistencia fija forma un divisor que el ADC puede medir.",
    orientation: "No tiene polaridad.",
  },
  button: {
    type: "button",
    name: "Pulsador de 12 mm",
    mount: "board",
    pins: [
      { id: "a1", label: "contacto A", role: "passive" },
      { id: "a2", label: "contacto A", role: "passive" },
      { id: "b1", label: "contacto B", role: "passive" },
      { id: "b2", label: "contacto B", role: "passive" },
    ],
    model: {
      kind: "switch",
      joined: [
        ["a1", "a2"],
        ["b1", "b2"],
      ],
    },
    about:
      "Interruptor que une sus dos contactos mientras lo presionas. Tiene cuatro patas, unidas de a dos por dentro.",
    orientation:
      "Va a caballo sobre el canal central. Usa dos patas en diagonal y funcionará en cualquier giro.",
  },
  buzzer: {
    type: "buzzer",
    name: "Buzzer pasivo (piezo)",
    mount: "board",
    pins: [
      { id: "mas", label: "+", aka: ["pata larga"], role: "passive" },
      { id: "menos", label: "−", role: "passive" },
    ],
    model: { kind: "passive" },
    about:
      "Pequeño parlante piezoeléctrico. Suena cuando el pin cambia de 0 a 1 muchas veces por segundo (PWM).",
    orientation: "La pata marcada con + (o la más larga) va hacia el pin GP.",
  },
  potentiometer: {
    type: "potentiometer",
    name: "Potenciómetro de 10 kΩ",
    mount: "board",
    pins: [
      { id: "ext1", label: "extremo 1", role: "passive" },
      { id: "cursor", label: "cursor (centro)", role: "signal" },
      { id: "ext2", label: "extremo 2", role: "passive" },
    ],
    model: { kind: "variable", between: ["ext1", "ext2"] },
    about:
      "Resistencia ajustable con una perilla. La pata central entrega un voltaje entre los dos extremos.",
    orientation: "La pata del centro es el cursor.",
  },
  lm35: {
    type: "lm35",
    name: "Sensor de temperatura LM35",
    mount: "board",
    pins: [
      { id: "vs", label: "+VS", role: "vcc" },
      { id: "vout", label: "VOUT", role: "signal" },
      { id: "gnd", label: "GND", role: "gnd" },
    ],
    model: { kind: "active", vcc: "vs", gnd: "gnd", supply: [5], outputs: { vout: 1.5 } },
    about:
      "Entrega 10 mV por cada grado Celsius. A 25 °C su salida es 0,25 V.",
    orientation:
      "Con la cara plana hacia ti y las patas hacia abajo: +VS, VOUT, GND, de izquierda a derecha. Confirma en la ficha de tu pieza.",
  },
  tilt: {
    type: "tilt",
    name: "Sensor de inclinación SW520D",
    mount: "board",
    pins: [
      { id: "a", label: "pata 1", role: "passive" },
      { id: "b", label: "pata 2", role: "passive" },
    ],
    model: { kind: "variable", between: ["a", "b"] },
    about:
      "Interruptor con una bolita metálica dentro: abre o cierra el contacto según su inclinación. No mide ángulos.",
    orientation: "No tiene polaridad.",
  },
  soil: {
    type: "soil",
    name: "Sonda de humedad capacitiva v1.2",
    mount: "module",
    pins: [
      { id: "GND", label: "GND", role: "gnd" },
      { id: "VCC", label: "VCC", role: "vcc" },
      { id: "AOUT", label: "AOUT", aka: ["AUOT", "A"], role: "signal" },
    ],
    model: {
      kind: "active",
      vcc: "VCC",
      gnd: "GND",
      supply: [3.3, 5],
      outputs: { AOUT: "vcc" },
    },
    about:
      "Mide cuánta agua hay en la tierra por su efecto en un condensador. Entrega un voltaje: más agua, distinto número.",
    orientation:
      "Entierra solo hasta la línea marcada. La electrónica de arriba y el conector deben quedar secos.",
  },
  ds18b20: {
    type: "ds18b20",
    name: "Termómetro DS18B20 sumergible",
    mount: "module",
    pins: [
      { id: "VDD", label: "VDD", aka: ["hilo rojo"], role: "vcc" },
      { id: "DATA", label: "DATA", aka: ["hilo amarillo", "hilo blanco"], role: "signal" },
      { id: "GND", label: "GND", aka: ["hilo negro"], role: "gnd" },
    ],
    model: {
      kind: "active",
      vcc: "VDD",
      gnd: "GND",
      supply: [3.3, 5],
      outputs: { DATA: "open" },
    },
    about:
      "Termómetro digital dentro de una cápsula de acero. Habla por un solo hilo (1-Wire) y cada uno tiene un número de serie único.",
    orientation:
      "Lo habitual es rojo = VDD, negro = GND y amarillo = DATA. Confirma los colores de tu cable antes de dar energía.",
  },
  dht11: {
    type: "dht11",
    name: "Sensor DHT11 (módulo de 3 patas)",
    mount: "board",
    pins: [
      { id: "VCC", label: "VCC", aka: ["+"], role: "vcc" },
      { id: "DATA", label: "DATA", aka: ["S", "OUT"], role: "signal" },
      { id: "GND", label: "GND", aka: ["−"], role: "gnd" },
    ],
    model: {
      kind: "active",
      vcc: "VCC",
      gnd: "GND",
      supply: [3.3, 5],
      outputs: { DATA: "pullup" },
    },
    about:
      "Mide temperatura y humedad del aire y las envía juntas por un solo pin, con un número de control para detectar errores.",
    orientation:
      "El orden de las patas cambia entre fabricantes: guíate por las marcas +, − y S (o VCC, GND y DATA) impresas en tu módulo.",
  },
  rain: {
    type: "rain",
    name: "Sensor de lluvia FC-37 + módulo LM393",
    mount: "module",
    pins: [
      { id: "VCC", label: "VCC", role: "vcc" },
      { id: "GND", label: "GND", role: "gnd" },
      { id: "DO", label: "DO", role: "signal" },
      { id: "AO", label: "AO", role: "signal" },
    ],
    model: {
      kind: "active",
      vcc: "VCC",
      gnd: "GND",
      supply: [3.3, 5],
      outputs: { DO: "pullup", AO: "vcc" },
    },
    about:
      "Una placa con pistas detecta gotas; el módulo LM393 compara esa señal con un umbral que ajustas con un tornillo y responde sí o no.",
    orientation:
      "La placa de pistas se une al módulo con dos hilos (sin polaridad). Usa la salida DO; AO queda libre.",
  },
  water: {
    type: "water",
    name: "Sensor de nivel de agua",
    mount: "module",
    pins: [
      { id: "S", label: "S", aka: ["SIG", "OUT"], role: "signal" },
      { id: "VCC", label: "+", aka: ["VCC"], role: "vcc" },
      { id: "GND", label: "−", aka: ["GND"], role: "gnd" },
    ],
    model: {
      kind: "active",
      vcc: "VCC",
      gnd: "GND",
      supply: [3.3, 5],
      outputs: { S: "vcc" },
    },
    about:
      "Sus pistas paralelas conducen más cuanto más quedan cubiertas por el agua. Entrega un voltaje que sube con el nivel.",
    orientation: "Sumerge solo la zona de pistas. El conector nunca toca el agua.",
  },
  hcsr04: {
    type: "hcsr04",
    name: "Sensor ultrasónico HC-SR04",
    mount: "board",
    pins: [
      { id: "VCC", label: "VCC", role: "vcc" },
      { id: "TRIG", label: "Trig", role: "signal" },
      { id: "ECHO", label: "Echo", role: "signal" },
      { id: "GND", label: "GND", role: "gnd" },
    ],
    model: {
      kind: "active",
      vcc: "VCC",
      gnd: "GND",
      supply: [5],
      outputs: { ECHO: "vcc" },
    },
    about:
      "Emite un pulso de ultrasonido y mide cuánto tarda en volver el eco. Con ese tiempo se calcula la distancia.",
    orientation:
      "Con los dos «ojos» mirando hacia ti, las patas son VCC, Trig, Echo y GND de izquierda a derecha.",
  },
  pir: {
    type: "pir",
    name: "Sensor de movimiento PIR HC-SR501",
    mount: "module",
    pins: [
      { id: "VCC", label: "VCC", aka: ["+"], role: "vcc" },
      { id: "OUT", label: "OUT", role: "signal" },
      { id: "GND", label: "GND", aka: ["−"], role: "gnd" },
    ],
    model: {
      kind: "active",
      vcc: "VCC",
      gnd: "GND",
      supply: [5],
      outputs: { OUT: 3.3 },
    },
    about:
      "Detecta cambios de calor infrarrojo, como una mano que se mueve. No ve imágenes ni detecta a alguien quieto.",
    orientation:
      "Las marcas VCC, OUT y GND están junto a las patas (a veces bajo la cúpula blanca). El orden cambia entre fabricantes.",
  },
};

export function partDef(part: PartInstance): PartDef {
  if (part.type === "generic")
    return {
      type: "generic",
      name: part.label,
      mount: "module",
      pins: (part.pins ?? []).map((id) => ({ id, label: id, role: "passive" as const })),
      model: { kind: "passive" },
      about: part.label,
    };
  return PARTS[part.type];
}

/** Caída de voltaje típica de cada color de LED. */
export const LED_VF: Record<string, number> = { rojo: 1.8, amarillo: 2.0, azul: 2.9 };
