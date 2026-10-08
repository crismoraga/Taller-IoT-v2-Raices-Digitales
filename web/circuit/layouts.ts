import {
  cable,
  compose,
  jumper,
  resistor,
  type Circuit,
  type PartInstance,
  type Wire,
  type WiringStep,
} from "./model";

/**
 * Plano maestro de la protoboard del taller.
 *
 * Cada componente tiene un lugar reservado, de modo que lo que se arma en una actividad
 * queda en su sitio para la estación completa. La revisión eléctrica (netlist.ts) verifica
 * cada montaje en los tests: agujeros válidos, sin cortocircuitos, GPIO ≤ 3,3 V, corriente
 * de LED segura y uniones idénticas al netlist esperado.
 *
 *   Pico W: números 1–20 (patas en c y h, USB hacia la izquierda).
 *   Rieles rojos (+) = 3,3 V · rieles azules (−) = GND. Los 5 V solo salen de la tira de
 *   VBUS (i1 y j1): nunca van a un riel, así es imposible alimentar con 5 V por error.
 *
 *   Mitad superior (f–j):  DS18B20 22–25 · LDR 28–30 · LM35 33–35 · potenciómetro 37–41 ·
 *                          divisor del HC-SR04 43–59
 *   Mitad inferior (a–e):  LED 22–27 · buzzer 29–36 · pulsador 38–40 · DHT11 44–46 ·
 *                          HC-SR04 57–60
 */

type Fragment = Pick<Circuit, "parts" | "wires" | "steps" | "nets">;

const fragment = (
  parts: PartInstance[],
  wires: Wire[],
  steps: WiringStep[],
  nets: string[][],
): Fragment => ({ parts, wires, steps, nets });

/* ── Alimentación: rieles y puentes ───────────────────────────── */

const gndBottom = fragment(
  [],
  [jumper("w_gnd_bottom", "a3", "bn:3", "negro", "GND")],
  [
    {
      id: "gnd-bottom",
      kind: "wire",
      title: "Lleva GND al riel azul de abajo",
      detail:
        "El agujero a3 está unido al pin GND (pin 3) de la Pico. Con este cable, todo el riel azul de abajo pasa a ser GND.",
      wires: ["w_gnd_bottom"],
      why: "GND es el punto de 0 V. Todos los componentes lo comparten para que sus señales se midan contra la misma referencia.",
      verify: "El cable negro sale de a3 y llega a la línea azul.",
      shared: true,
    },
  ],
  [],
);

const gndTop = fragment(
  [],
  [jumper("w_gnd_top", "j3", "tn:3", "negro", "GND")],
  [
    {
      id: "gnd-top",
      kind: "wire",
      title: "Lleva GND al riel azul de arriba",
      detail:
        "El agujero j3 está unido al pin GND (pin 38). Ahora el riel azul de arriba también es GND.",
      wires: ["w_gnd_top"],
      verify: "El cable negro sale de j3 y llega a la línea azul de arriba.",
      shared: true,
    },
  ],
  [],
);

const v33Top = fragment(
  [],
  [jumper("w_3v3_top", "j5", "tp:5", "rojo", "3V3")],
  [
    {
      id: "3v3-top",
      kind: "wire",
      title: "Lleva 3,3 V al riel rojo de arriba",
      detail:
        "El agujero j5 está unido al pin 3V3 (pin 36). El riel rojo de arriba queda con 3,3 V para alimentar sensores.",
      wires: ["w_3v3_top"],
      warning:
        "Cuenta bien: es j5, no j1. En j1 está VBUS, que entrega 5 V y puede dañar los pines GP.",
      why: "3V3 es la salida regulada de la Pico. Sus pines GP trabajan a ese mismo voltaje, así que es la alimentación segura para los sensores.",
      verify: "El cable rojo sale de j5: el quinto agujero contando desde el USB.",
      shared: true,
    },
  ],
  [],
);

const v33Bottom = fragment(
  [],
  [jumper("w_3v3_bottom", "tp:21", "bp:21", "rojo", "3V3")],
  [
    {
      id: "3v3-bottom",
      kind: "wire",
      title: "Une los dos rieles rojos",
      detail:
        "Cruza un cable rojo desde el riel rojo de arriba hasta el riel rojo de abajo, a la altura del número 21. Los dos rieles rojos quedan con 3,3 V.",
      wires: ["w_3v3_bottom"],
      verify: "El cable une rojo con rojo. Nunca rojo con azul.",
      shared: true,
    },
  ],
  [],
);

const bridge = (rail: "tn" | "bp" | "bn"): Fragment => {
  const info = {
    tn: { name: "azul de arriba", color: "negro" as const, carries: "GND" },
    bp: { name: "rojo de abajo", color: "rojo" as const, carries: "3V3" },
    bn: { name: "azul de abajo", color: "negro" as const, carries: "GND" },
  }[rail];
  return fragment(
    [],
    [jumper(`w_bridge_${rail}`, `${rail}:31`, `${rail}:33`, info.color, info.carries)],
    [
      {
        id: `bridge-${rail}`,
        kind: "wire",
        title: `Puente en el riel ${info.name}`,
        detail: `Une los agujeros frente a los números 31 y 33 del riel ${info.name}. Algunas protoboards cortan sus rieles al centro: este puente une las dos mitades.`,
        wires: [`w_bridge_${rail}`],
        tip: "Si la línea de color de tu riel no se interrumpe al centro, el puente no hace falta, pero tampoco molesta.",
        shared: true,
      },
    ],
    [],
  );
};

/* ── Etapa 1: LED ─────────────────────────────────────────────── */

const led = fragment(
  [
    {
      id: "led",
      type: "led",
      label: "LED rojo",
      props: { color: "rojo" },
      holes: { anodo: "d26", catodo: "d27" },
    },
    resistor("r_led", 220, "c22", "c26"),
  ],
  [
    jumper("w_led_sig", "a4", "a22", "verde", "señal GP2"),
    jumper("w_led_gnd", "a27", "bn:27", "negro", "GND"),
  ],
  [
    {
      id: "led-place",
      kind: "place",
      title: "Coloca el LED: pata larga en d26, pata corta en d27",
      detail:
        "La pata larga es el ánodo (+) y va en d26. La pata corta va en d27. Si las cortaron, busca el borde plano de la cápsula: ese lado es la pata corta.",
      parts: ["led"],
      why: "Un LED solo conduce en un sentido. Si lo pones al revés no se daña, pero no enciende.",
      verify: "La pata larga quedó en el número 26.",
    },
    {
      id: "led-resistor",
      kind: "place",
      title: "Coloca la resistencia de 220 Ω entre c22 y c26",
      detail:
        "Dobla sus patas en forma de U. Una va en c22 y la otra en c26: así queda unida a la pata larga del LED, que comparte la tira del número 26.",
      parts: ["r_led"],
      why: "La resistencia limita la corriente a unos 7 mA. Sin ella, el LED y el pin de la Pico podrían dañarse.",
      tip: "220 Ω se reconoce por sus bandas: rojo, rojo, café y dorado. No tiene polaridad.",
      verify: "La resistencia y la pata larga del LED comparten el número 26.",
    },
    {
      id: "led-signal",
      kind: "wire",
      title: "Cable verde: de a4 (GP2) a a22",
      detail:
        "El agujero a4 está unido al pin GP2 (pin 4). El cable lleva esa señal hasta la resistencia, en el número 22.",
      wires: ["w_led_sig"],
      tip: "Puedes usar otro color, pero evita el rojo y el negro: los reservamos para alimentación y GND.",
      verify: "El cable sale del cuarto agujero contando desde el USB.",
    },
    {
      id: "led-gnd",
      kind: "wire",
      title: "Cable negro: de a27 al riel azul de abajo",
      detail:
        "La pata corta del LED está en el número 27. Este cable la lleva a GND y cierra el circuito.",
      wires: ["w_led_gnd"],
      why: "La corriente sale de GP2, pasa por la resistencia y el LED, y vuelve a la Pico por GND. Sin el camino de vuelta no circula.",
      verify: "El camino completo es: GP2 → resistencia → LED → GND.",
    },
  ],
  [
    ["pico:GP2", "r_led.a"],
    ["r_led.b", "led.anodo"],
    ["led.catodo", "pico:GND"],
  ],
);

/* ── Etapa 2: buzzer, pulsador, inclinación ───────────────────── */

const buzzer = fragment(
  [
    {
      id: "buzzer",
      type: "buzzer",
      label: "Buzzer pasivo",
      holes: { mas: "d33", menos: "d36" },
    },
    resistor("r_buz", 220, "c29", "c33"),
  ],
  [
    jumper("w_buz_sig", "a5", "a29", "morado", "señal GP3"),
    jumper("w_buz_gnd", "a36", "bn:30", "negro", "GND"),
  ],
  [
    {
      id: "buzzer-place",
      kind: "place",
      title: "Coloca el buzzer: pata + en d33, la otra en d36",
      detail:
        "Usa el buzzer pasivo: por debajo se ve su circuito verde. La pata marcada con + va en d33.",
      parts: ["buzzer"],
      tip: "El buzzer activo tiene la base sellada con resina negra y suena solo al darle energía. Ese no va directo a un pin GP.",
      verify: "El + del buzzer quedó en el número 33.",
    },
    {
      id: "buzzer-resistor",
      kind: "place",
      title: "Coloca una resistencia de 220 Ω entre c29 y c33",
      detail:
        "Queda unida a la pata + del buzzer, que comparte la tira del número 33.",
      parts: ["r_buz"],
      why: "Limita la corriente que entrega el pin GP3.",
    },
    {
      id: "buzzer-signal",
      kind: "wire",
      title: "Cable morado: de a5 (GP3) a a29",
      detail: "El agujero a5 está unido al pin GP3 (pin 5).",
      wires: ["w_buz_sig"],
    },
    {
      id: "buzzer-gnd",
      kind: "wire",
      title: "Cable negro: de a36 al riel azul de abajo",
      detail: "Lleva la otra pata del buzzer a GND, frente al número 30.",
      wires: ["w_buz_gnd"],
      verify: "El camino es: GP3 → resistencia → buzzer → GND.",
    },
  ],
  [
    ["pico:GP3", "r_buz.a"],
    ["r_buz.b", "buzzer.mas"],
    ["buzzer.menos", "pico:GND"],
  ],
);

const button = fragment(
  [
    {
      id: "button",
      type: "button",
      label: "Pulsador",
      holes: { a1: "d38", a2: "g38", b1: "d40", b2: "g40" },
    },
  ],
  [
    jumper("w_btn_sig", "a6", "a38", "azul", "señal GP4"),
    jumper("w_btn_gnd", "j40", "tn:29", "negro", "GND"),
  ],
  [
    {
      id: "button-place",
      kind: "place",
      title: "Coloca el pulsador a caballo sobre el canal: números 38 y 40",
      detail:
        "Sus cuatro patas entran en d38, g38, d40 y g40. Presiona con firmeza hasta que quede plano.",
      parts: ["button"],
      why: "Por dentro, las patas del número 38 están unidas entre sí y las del 40 también. Al presionar, el 38 se une con el 40.",
      verify: "El pulsador cruza el canal central y no baila.",
    },
    {
      id: "button-signal",
      kind: "wire",
      title: "Cable azul: de a6 (GP4) a a38",
      detail: "El agujero a6 está unido al pin GP4 (pin 6).",
      wires: ["w_btn_sig"],
    },
    {
      id: "button-gnd",
      kind: "wire",
      title: "Cable negro: de j40 al riel azul de arriba",
      detail:
        "Sale de la pata en diagonal a la del cable azul y llega a GND, frente al número 29.",
      wires: ["w_btn_gnd"],
      why: "Usamos patas en diagonal porque funcionan sin importar cómo quedó girado el pulsador.",
      warning:
        "El pulsador va entre GP4 y GND. Nunca lo conectes entre 3V3 y GND: al presionarlo harías un cortocircuito.",
    },
  ],
  [
    ["pico:GP4", "button.a1", "button.a2"],
    ["button.b1", "button.b2", "pico:GND"],
  ],
);

const tilt = fragment(
  [
    {
      id: "tilt",
      type: "tilt",
      label: "Sensor de inclinación SW520D",
      holes: { a: "c38", b: "c40" },
    },
  ],
  [
    jumper("w_tilt_sig", "a6", "a38", "azul", "señal GP4"),
    jumper("w_tilt_gnd", "a40", "bn:29", "negro", "GND"),
  ],
  [
    {
      id: "tilt-place",
      kind: "place",
      title: "Coloca el SW520D: una pata en c38 y la otra en c40",
      detail: "Déjalo parado, con el cilindro metálico hacia arriba. No tiene polaridad.",
      parts: ["tilt"],
      tip: "Si antes armaste el pulsador en este lugar, retíralo primero: ambos usan GP4.",
    },
    {
      id: "tilt-signal",
      kind: "wire",
      title: "Cable azul: de a6 (GP4) a a38",
      detail: "El agujero a6 está unido al pin GP4 (pin 6).",
      wires: ["w_tilt_sig"],
    },
    {
      id: "tilt-gnd",
      kind: "wire",
      title: "Cable negro: de a40 al riel azul de abajo",
      detail: "Lleva la otra pata a GND, frente al número 29.",
      wires: ["w_tilt_gnd"],
    },
  ],
  [
    ["pico:GP4", "tilt.a"],
    ["tilt.b", "pico:GND"],
  ],
);

/* ── Etapa 3: sensores analógicos ─────────────────────────────── */

const ldr = fragment(
  [
    {
      id: "ldr",
      type: "ldr",
      label: "Fotorresistencia LDR",
      holes: { a: "g28", b: "g30" },
    },
    resistor("r_ldr", 10000, "h30", "tn:30"),
  ],
  [
    jumper("w_ldr_3v3", "j28", "tp:28", "rojo", "3V3"),
    jumper("w_ldr_sig", "j30", "j9", "verde", "señal GP27"),
  ],
  [
    {
      id: "ldr-place",
      kind: "place",
      title: "Coloca la LDR: una pata en g28 y la otra en g30",
      detail: "Es el disco con una línea en zigzag. No tiene polaridad.",
      parts: ["ldr"],
    },
    {
      id: "ldr-resistor",
      kind: "place",
      title: "Resistencia de 10 kΩ: de h30 al riel azul de arriba",
      detail:
        "Una pata va en h30, junto a la LDR. La otra va directo al riel azul, frente al número 30.",
      parts: ["r_ldr"],
      tip: "10 kΩ se reconoce por sus bandas: café, negro, naranja y dorado.",
      why: "La LDR y esta resistencia forman un divisor de voltaje. El punto donde se unen cambia de voltaje según la luz.",
    },
    {
      id: "ldr-3v3",
      kind: "wire",
      title: "Cable rojo: de j28 al riel rojo de arriba",
      detail: "Alimenta la primera pata de la LDR con 3,3 V.",
      wires: ["w_ldr_3v3"],
      warning: "Usa el riel rojo (3,3 V). Las entradas analógicas no soportan 5 V.",
    },
    {
      id: "ldr-signal",
      kind: "wire",
      title: "Cable verde: de j30 a j9 (GP27)",
      detail:
        "j30 es el punto donde se unen la LDR y la resistencia. j9 está unido al pin GP27 (pin 32), la entrada analógica ADC1.",
      wires: ["w_ldr_sig"],
      verify: "El camino es: 3,3 V → LDR → punto de medida (GP27) → 10 kΩ → GND.",
    },
  ],
  [
    ["pico:3V3", "ldr.a"],
    ["ldr.b", "r_ldr.a", "pico:GP27"],
    ["r_ldr.b", "pico:GND"],
  ],
);

const lm35 = fragment(
  [
    {
      id: "lm35",
      type: "lm35",
      label: "Sensor LM35",
      holes: { vs: "f33", vout: "f34", gnd: "f35" },
    },
  ],
  [
    jumper("w_lm35_5v", "j33", "j1", "naranja", "5 V (VBUS)"),
    jumper("w_lm35_out", "j34", "j10", "amarillo", "señal GP26"),
    jumper("w_lm35_gnd", "j35", "tn:27", "negro", "GND"),
  ],
  [
    {
      id: "lm35-place",
      kind: "place",
      title: "Coloca el LM35 en f33, f34 y f35, con la cara plana hacia ti",
      detail:
        "Con la cara plana mirando hacia el canal central, sus patas son +VS (f33), VOUT (f34) y GND (f35).",
      parts: ["lm35"],
      warning:
        "Si lo pones al revés se calienta en segundos. Si notas calor, desconecta el USB de inmediato.",
      verify: "La cara plana con letras mira hacia las letras a–e.",
    },
    {
      id: "lm35-5v",
      kind: "wire",
      title: "Cable naranja: de j33 a j1 (VBUS, 5 V)",
      detail: "El LM35 necesita al menos 4 V. Los toma de VBUS, los 5 V del USB.",
      wires: ["w_lm35_5v"],
      warning:
        "Este es el único cable de 5 V. Va solo a la pata +VS del LM35, nunca a un pin GP.",
    },
    {
      id: "lm35-out",
      kind: "wire",
      title: "Cable amarillo: de j34 a j10 (GP26)",
      detail:
        "La salida del LM35 entrega 10 mV por grado: a 25 °C son solo 0,25 V, muy por debajo de 3,3 V.",
      wires: ["w_lm35_out"],
      tip: "GP26 es la misma entrada de la sonda de suelo. Retira antes el cable de la sonda de j10.",
    },
    {
      id: "lm35-gnd",
      kind: "wire",
      title: "Cable negro: de j35 al riel azul de arriba",
      detail: "Lleva GND al LM35, frente al número 27.",
      wires: ["w_lm35_gnd"],
    },
  ],
  [
    ["pico:VBUS", "lm35.vs"],
    ["pico:GP26", "lm35.vout"],
    ["pico:GND", "lm35.gnd"],
  ],
);

const potentiometer = fragment(
  [
    {
      id: "pot",
      type: "potentiometer",
      label: "Potenciómetro de 10 kΩ",
      holes: { ext1: "f37", cursor: "f39", ext2: "f41" },
    },
  ],
  [
    jumper("w_pot_3v3", "j37", "tp:29", "rojo", "3V3"),
    jumper("w_pot_sig", "j39", "j10", "amarillo", "señal GP26"),
    jumper("w_pot_gnd", "j41", "tn:25", "negro", "GND"),
  ],
  [
    {
      id: "pot-place",
      kind: "place",
      title: "Coloca el potenciómetro: patas en f37, f39 y f41",
      detail: "La pata del centro (el cursor) queda en f39.",
      parts: ["pot"],
    },
    {
      id: "pot-3v3",
      kind: "wire",
      title: "Cable rojo: de j37 al riel rojo de arriba",
      detail: "Un extremo del potenciómetro recibe 3,3 V.",
      wires: ["w_pot_3v3"],
      warning: "Usa 3,3 V, no 5 V: el cursor llega directo a una entrada analógica.",
    },
    {
      id: "pot-gnd",
      kind: "wire",
      title: "Cable negro: de j41 al riel azul de arriba",
      detail: "El otro extremo va a GND.",
      wires: ["w_pot_gnd"],
    },
    {
      id: "pot-signal",
      kind: "wire",
      title: "Cable amarillo: de j39 a j10 (GP26)",
      detail:
        "El cursor entrega un voltaje entre 0 y 3,3 V según giras la perilla.",
      wires: ["w_pot_sig"],
      tip: "GP26 es la misma entrada de la sonda de suelo. Retira antes el cable de la sonda de j10.",
    },
  ],
  [
    ["pico:3V3", "pot.ext1"],
    ["pico:GP26", "pot.cursor"],
    ["pico:GND", "pot.ext2"],
  ],
);

/* ── Etapas 4 a 6: sensores comprados ─────────────────────────── */

const dht11 = fragment(
  [
    {
      id: "dht",
      type: "dht11",
      label: "Sensor DHT11",
      holes: { VCC: "a44", DATA: "a45", GND: "a46" },
    },
  ],
  [
    jumper("w_dht_3v3", "c44", "bp:41", "rojo", "3V3"),
    jumper("w_dht_sig", "c45", "b20", "amarillo", "señal GP15"),
    jumper("w_dht_gnd", "c46", "bn:49", "negro", "GND"),
  ],
  [
    {
      id: "dht-place",
      kind: "place",
      title: "Enchufa el DHT11 en a44, a45 y a46, mirando hacia afuera",
      detail:
        "La rejilla celeste mira hacia el borde de la protoboard. En este dibujo sus patas son VCC (44), DATA (45) y GND (46).",
      parts: ["dht"],
      warning:
        "El orden de las patas cambia entre fabricantes. Lee las marcas de TU módulo (+ o VCC, S o DATA, − o GND) y conecta cada cable según la marca, no según la posición.",
      verify: "Identifiqué cuál pata es VCC, cuál es DATA y cuál es GND en mi módulo.",
    },
    {
      id: "dht-3v3",
      kind: "wire",
      title: "Cable rojo: de la tira de VCC (c44) al riel rojo de abajo",
      detail: "Alimenta el sensor con 3,3 V, frente al número 41.",
      wires: ["w_dht_3v3"],
      warning: "Usa el riel rojo (3,3 V). Con 5 V, la señal DATA dañaría el pin GP15.",
    },
    {
      id: "dht-gnd",
      kind: "wire",
      title: "Cable negro: de la tira de GND (c46) al riel azul de abajo",
      detail: "Lleva GND al sensor, frente al número 49.",
      wires: ["w_dht_gnd"],
    },
    {
      id: "dht-signal",
      kind: "wire",
      title: "Cable amarillo: de la tira de DATA (c45) a b20 (GP15)",
      detail: "b20 está unido al pin GP15 (pin 20), el último de la fila de abajo.",
      wires: ["w_dht_sig"],
      tip: "El módulo de 3 patas ya trae su resistencia de 10 kΩ. Si tu DHT11 es el sensor suelto de 4 patas, agrega una resistencia de 10 kΩ entre DATA y 3,3 V.",
    },
  ],
  [
    ["pico:3V3", "dht.VCC"],
    ["pico:GP15", "dht.DATA"],
    ["pico:GND", "dht.GND"],
  ],
);

const soil = fragment(
  [{ id: "soil", type: "soil", label: "Sonda de humedad de suelo", at: { x: 9, y: -9.5 } }],
  [
    cable("c_soil_3v3", "soil.VCC", "tp:11", "rojo", "3V3"),
    cable("c_soil_gnd", "soil.GND", "tn:12", "negro", "GND"),
    cable("c_soil_sig", "soil.AOUT", "j10", "amarillo", "señal GP26"),
  ],
  [
    {
      id: "soil-cable",
      kind: "place",
      title: "Conecta el cable de 3 hilos a la sonda",
      detail:
        "El conector blanco entra en una sola posición. Si las puntas del cable son hembra, ponles un pin macho de la tira del kit para poder enchufarlas en la protoboard.",
      parts: ["soil"],
      verify: "Miré las letras de la sonda: sé qué hilo es VCC, cuál es GND y cuál es AOUT.",
    },
    {
      id: "soil-3v3",
      kind: "wire",
      title: "Hilo rojo (VCC): al riel rojo de arriba",
      detail: "Alimenta la sonda con 3,3 V, frente al número 11.",
      wires: ["c_soil_3v3"],
      warning: "Usa el riel rojo (3,3 V), no los 5 V de VBUS.",
    },
    {
      id: "soil-gnd",
      kind: "wire",
      title: "Hilo negro (GND): al riel azul de arriba",
      detail: "Lleva GND a la sonda, frente al número 12.",
      wires: ["c_soil_gnd"],
    },
    {
      id: "soil-signal",
      kind: "wire",
      title: "Hilo amarillo (AOUT): a j10 (GP26)",
      detail:
        "j10 está unido al pin GP26 (pin 31), la entrada analógica ADC0. Por aquí llega la medición.",
      wires: ["c_soil_sig"],
      tip: "Los colores del cable pueden variar: guíate por las letras impresas en la sonda.",
      verify: "El hilo de AOUT llegó al número 10 de la letra j.",
    },
  ],
  [
    ["pico:3V3", "soil.VCC"],
    ["pico:GND", "soil.GND"],
    ["pico:GP26", "soil.AOUT"],
  ],
);

const ds18b20 = fragment(
  [
    { id: "ds", type: "ds18b20", label: "Termómetro DS18B20", at: { x: 25, y: -9.5 } },
    resistor("r_ds1", 10000, "h24", "tp:24"),
    resistor("r_ds2", 10000, "g24", "tp:25"),
  ],
  [
    cable("c_ds_3v3", "ds.VDD", "tp:22", "rojo", "3V3"),
    cable("c_ds_gnd", "ds.GND", "tn:23", "negro", "GND"),
    cable("c_ds_sig", "ds.DATA", "j24", "amarillo", "DATA"),
    jumper("w_ds_sig", "i24", "i20", "amarillo", "señal GP16"),
  ],
  [
    {
      id: "ds-3v3",
      kind: "wire",
      title: "Hilo rojo (VDD): al riel rojo de arriba",
      detail: "Enchufa la punta pelada del hilo rojo en el riel rojo, frente al número 22.",
      parts: ["ds"],
      wires: ["c_ds_3v3"],
      tip: "Lo habitual es rojo = VDD, negro = GND y amarillo = DATA. Si tu cable trae otros colores, pregunta antes de dar energía.",
    },
    {
      id: "ds-gnd",
      kind: "wire",
      title: "Hilo negro (GND): al riel azul de arriba",
      detail: "Frente al número 23.",
      wires: ["c_ds_gnd"],
    },
    {
      id: "ds-data",
      kind: "wire",
      title: "Hilo amarillo (DATA): a j24",
      detail: "La tira f–j del número 24 será el punto de datos del termómetro.",
      wires: ["c_ds_sig"],
    },
    {
      id: "ds-pullup-1",
      kind: "place",
      title: "Primera resistencia de 10 kΩ: de h24 al riel rojo",
      detail: "Una pata en h24 y la otra en el riel rojo de arriba, frente al número 24.",
      parts: ["r_ds1"],
      why: "El bus 1-Wire necesita una resistencia «pull-up» de unos 4,7 kΩ entre DATA y 3,3 V. El kit no trae ese valor, así que lo armamos con dos de 10 kΩ.",
    },
    {
      id: "ds-pullup-2",
      kind: "place",
      title: "Segunda resistencia de 10 kΩ: de g24 al riel rojo",
      detail:
        "Igual que la anterior, pero desde g24 hasta el riel rojo frente al número 25. Las dos quedan en paralelo.",
      parts: ["r_ds2"],
      why: "Dos resistencias de 10 kΩ en paralelo equivalen a 5 kΩ. Una detrás de la otra sumarían 20 kΩ y el termómetro no respondería.",
      verify: "Las dos resistencias salen de la tira del número 24 y llegan al riel rojo.",
    },
    {
      id: "ds-signal",
      kind: "wire",
      title: "Cable amarillo: de i24 a i20 (GP16)",
      detail: "i20 está unido al pin GP16 (pin 21), el último de la fila de arriba.",
      wires: ["w_ds_sig"],
    },
  ],
  [
    ["pico:3V3", "ds.VDD", "r_ds1.b", "r_ds2.b"],
    ["ds.DATA", "r_ds1.a", "r_ds2.a", "pico:GP16"],
    ["ds.GND", "pico:GND"],
  ],
);

const rain = fragment(
  [{ id: "rain", type: "rain", label: "Módulo de lluvia LM393", at: { x: 10, y: 20.5 } }],
  [
    cable("c_rain_3v3", "rain.VCC", "bp:15", "rojo", "3V3"),
    cable("c_rain_gnd", "rain.GND", "bn:16", "negro", "GND"),
    cable("c_rain_sig", "rain.DO", "a19", "azul", "señal GP14"),
  ],
  [
    {
      id: "rain-plate",
      kind: "place",
      title: "Une la placa de gotas con el módulo LM393",
      detail:
        "Usa los dos hilos que trae el sensor: van de la placa de pistas a los dos pines del lado opuesto del módulo. No tienen polaridad.",
      parts: ["rain"],
    },
    {
      id: "rain-3v3",
      kind: "wire",
      title: "Cable rojo: del pin VCC del módulo al riel rojo de abajo",
      detail: "Usa un cable hembra-macho. Llega al riel rojo frente al número 15.",
      wires: ["c_rain_3v3"],
      warning: "Aliméntalo con 3,3 V. Con 5 V, su salida DO dañaría el pin GP14.",
    },
    {
      id: "rain-gnd",
      kind: "wire",
      title: "Cable negro: del pin GND del módulo al riel azul de abajo",
      detail: "Frente al número 16.",
      wires: ["c_rain_gnd"],
    },
    {
      id: "rain-signal",
      kind: "wire",
      title: "Cable azul: del pin DO del módulo a a19 (GP14)",
      detail:
        "a19 está unido al pin GP14 (pin 19). Usa DO, la salida digital; el pin AO queda libre.",
      wires: ["c_rain_sig"],
      verify: "Usé el pin marcado DO, no AO.",
    },
  ],
  [
    ["pico:3V3", "rain.VCC"],
    ["pico:GND", "rain.GND"],
    ["pico:GP14", "rain.DO"],
  ],
);

const water = fragment(
  [{ id: "water", type: "water", label: "Sensor de nivel de agua", at: { x: 1, y: -9.5 } }],
  [
    cable("c_water_3v3", "water.VCC", "tp:9", "rojo", "3V3"),
    cable("c_water_gnd", "water.GND", "tn:10", "negro", "GND"),
    cable("c_water_sig", "water.S", "j7", "blanco", "señal GP28"),
  ],
  [
    {
      id: "water-3v3",
      kind: "wire",
      title: "Cable rojo: del pin + del sensor al riel rojo de arriba",
      detail: "Usa un cable hembra-macho. Llega al riel rojo frente al número 9.",
      parts: ["water"],
      wires: ["c_water_3v3"],
      warning: "Usa 3,3 V: la señal S llega directo a una entrada analógica.",
    },
    {
      id: "water-gnd",
      kind: "wire",
      title: "Cable negro: del pin − del sensor al riel azul de arriba",
      detail: "Frente al número 10.",
      wires: ["c_water_gnd"],
    },
    {
      id: "water-signal",
      kind: "wire",
      title: "Cable blanco: del pin S del sensor a j7 (GP28)",
      detail: "j7 está unido al pin GP28 (pin 34), la entrada analógica ADC2.",
      wires: ["c_water_sig"],
      warning:
        "Solo las pistas del sensor tocan el agua. El conector, los cables y la Pico se mantienen secos.",
    },
  ],
  [
    ["pico:3V3", "water.VCC"],
    ["pico:GND", "water.GND"],
    ["pico:GP28", "water.S"],
  ],
);

const hcsr04 = fragment(
  [
    {
      id: "hc",
      type: "hcsr04",
      label: "Sensor ultrasónico HC-SR04",
      holes: { VCC: "a57", TRIG: "a58", ECHO: "a59", GND: "a60" },
    },
    resistor("r_echo1", 1000, "e59", "f59"),
    resistor("r_echo2", 1000, "g59", "g55"),
    resistor("r_echo3", 1000, "h55", "h51"),
    resistor("r_echo4", 1000, "g51", "g47"),
    resistor("r_echo5", 1000, "h47", "h43"),
  ],
  [
    jumper("w_hc_gnd", "b60", "bn:60", "negro", "GND"),
    jumper("w_hc_trig", "c58", "i19", "verde", "señal GP17"),
    jumper("w_hc_div_gnd", "j43", "tn:43", "negro", "GND"),
    jumper("w_hc_echo", "i55", "j17", "azul", "señal GP18"),
    jumper("w_hc_5v", "b57", "j1", "naranja", "5 V (VBUS)"),
  ],
  [
    {
      id: "hc-place",
      kind: "place",
      title: "Enchufa el HC-SR04 en a57, a58, a59 y a60, mirando hacia ti",
      detail:
        "Con los dos «ojos» mirando hacia afuera, sus patas quedan así: VCC (57), Trig (58), Echo (59) y GND (60).",
      parts: ["hc"],
      verify: "Leí las marcas del sensor: VCC quedó en el número 57 y GND en el 60.",
    },
    {
      id: "hc-gnd",
      kind: "wire",
      title: "Cable negro: de b60 al riel azul de abajo",
      detail: "Lleva GND al sensor, frente al número 60.",
      wires: ["w_hc_gnd"],
    },
    {
      id: "hc-trig",
      kind: "wire",
      title: "Cable verde: de c58 a i19 (GP17)",
      detail:
        "Trig es la orden de disparo. i19 está unido al pin GP17 (pin 22). La Pico le envía 3,3 V y el sensor lo entiende bien.",
      wires: ["w_hc_trig"],
    },
    {
      id: "hc-div-1",
      kind: "place",
      title: "Resistencia de 1 kΩ sobre el canal: de e59 a f59",
      detail:
        "Cruza el canal central a la altura del número 59. Es la primera del divisor que protege a la Pico.",
      parts: ["r_echo1"],
      tip: "1 kΩ se reconoce por sus bandas: café, negro, rojo y dorado.",
      why: "El pin Echo responde con 5 V. Los pines GP soportan 3,3 V. Cinco resistencias iguales en fila reparten esos 5 V en cinco partes de 1 V.",
    },
    {
      id: "hc-div-2",
      kind: "place",
      title: "Segunda resistencia de 1 kΩ: de g59 a g55",
      detail: "Sigue la cadena hacia la izquierda. Termina en la tira del número 55.",
      parts: ["r_echo2"],
    },
    {
      id: "hc-div-3",
      kind: "place",
      title: "Tercera resistencia de 1 kΩ: de h55 a h51",
      detail: "Parte en la tira del 55 y termina en la del 51.",
      parts: ["r_echo3"],
    },
    {
      id: "hc-div-4",
      kind: "place",
      title: "Cuarta resistencia de 1 kΩ: de g51 a g47",
      detail: "Parte en la tira del 51 y termina en la del 47.",
      parts: ["r_echo4"],
    },
    {
      id: "hc-div-5",
      kind: "place",
      title: "Quinta resistencia de 1 kΩ: de h47 a h43",
      detail: "Es la última de la cadena. Termina en la tira del número 43.",
      parts: ["r_echo5"],
      verify: "Las cinco resistencias forman una sola fila en zigzag: 59 → 55 → 51 → 47 → 43.",
    },
    {
      id: "hc-div-gnd",
      kind: "wire",
      title: "Cable negro: de j43 al riel azul de arriba",
      detail: "El final de la cadena de resistencias va a GND.",
      wires: ["w_hc_div_gnd"],
      warning:
        "Sin este cable el divisor no divide: a GP18 le llegarían los 5 V completos.",
    },
    {
      id: "hc-echo",
      kind: "wire",
      title: "Cable azul: de i55 a j17 (GP18)",
      detail:
        "La tira del número 55 queda después de dos resistencias y antes de tres. Ahí hay 3 V: es el punto seguro para GP18 (pin 24).",
      wires: ["w_hc_echo"],
      warning:
        "Sale del número 55, no del 59. En el 59 está Echo directo, con 5 V, y eso daña el pin GP18.",
      why: "Divisor de voltaje: 5 V × 3 kΩ ÷ (2 kΩ + 3 kΩ) = 3 V.",
      verify: "El cable azul sale de la tira 55, entre la segunda y la tercera resistencia.",
    },
    {
      id: "hc-5v",
      kind: "wire",
      title: "Cable naranja: de b57 a j1 (VBUS, 5 V)",
      detail:
        "El HC-SR04 necesita 5 V. j1 está unido a VBUS (pin 40), los 5 V del USB. Lo conectamos al final, cuando el divisor ya está listo.",
      wires: ["w_hc_5v"],
      warning:
        "Este cable lleva 5 V. Va solo a VCC del sensor: nunca a un riel ni a un pin GP.",
      verify: "Revisé el divisor completo antes de conectar los 5 V.",
    },
  ],
  [
    ["pico:VBUS", "hc.VCC"],
    ["pico:GND", "hc.GND", "r_echo5.b"],
    ["pico:GP17", "hc.TRIG"],
    ["hc.ECHO", "r_echo1.a"],
    ["r_echo1.b", "r_echo2.a"],
    ["r_echo2.b", "r_echo3.a", "pico:GP18"],
    ["r_echo3.b", "r_echo4.a"],
    ["r_echo4.b", "r_echo5.a"],
  ],
);

const pir = fragment(
  [{ id: "pir", type: "pir", label: "Sensor de movimiento PIR", at: { x: 17, y: -9.5 } }],
  [
    cable("c_pir_gnd", "pir.GND", "tn:17", "negro", "GND"),
    cable("c_pir_sig", "pir.OUT", "j16", "blanco", "señal GP19"),
    cable("c_pir_5v", "pir.VCC", "i1", "naranja", "5 V (VBUS)"),
  ],
  [
    {
      id: "pir-gnd",
      kind: "wire",
      title: "Cable negro: del pin GND del sensor al riel azul de arriba",
      detail: "Usa un cable hembra-macho. Llega frente al número 17.",
      parts: ["pir"],
      wires: ["c_pir_gnd"],
      tip: "Las marcas VCC, OUT y GND están junto a las patas. En algunos modelos hay que levantar la cúpula blanca para verlas.",
      verify: "Identifiqué VCC, OUT y GND en mi sensor.",
    },
    {
      id: "pir-signal",
      kind: "wire",
      title: "Cable blanco: del pin OUT del sensor a j16 (GP19)",
      detail:
        "j16 está unido al pin GP19 (pin 25). Aunque el sensor se alimenta con 5 V, su salida OUT es de 3,3 V.",
      wires: ["c_pir_sig"],
    },
    {
      id: "pir-5v",
      kind: "wire",
      title: "Cable naranja: del pin VCC del sensor a i1 (VBUS, 5 V)",
      detail: "El PIR necesita 5 V. i1 está unido a VBUS (pin 40).",
      wires: ["c_pir_5v"],
      warning:
        "Este cable lleva 5 V. Va solo al pin VCC del sensor: nunca a un riel ni a un pin GP.",
      verify: "El cable naranja llega al pin VCC, no a OUT.",
    },
  ],
  [
    ["pico:VBUS", "pir.VCC"],
    ["pico:GP19", "pir.OUT"],
    ["pico:GND", "pir.GND"],
  ],
);

/* ── Montajes por actividad ───────────────────────────────────── */

const make = (
  id: string,
  title: string,
  fragments: Fragment[],
  view: Circuit["view"],
): Circuit => compose(id, title, fragments, view);

export const circuits = {
  led: make("led", "LED con resistencia en GP2", [gndBottom, led], { from: 1, to: 32 }),
  buzzer: make("buzzer", "Buzzer pasivo en GP3", [gndBottom, buzzer], { from: 1, to: 40 }),
  button: make("button", "Pulsador en GP4", [gndTop, button], { from: 1, to: 44 }),
  buttonLed: make(
    "button-led",
    "LED controlado por un pulsador",
    [gndBottom, gndTop, led, button],
    { from: 1, to: 44 },
  ),
  tilt: make("tilt", "Sensor de inclinación en GP4", [gndBottom, tilt], { from: 1, to: 44 }),
  ldr: make("ldr", "LDR con divisor en GP27", [v33Top, gndTop, ldr], { from: 1, to: 34 }),
  lm35: make("lm35", "LM35 en GP26", [gndTop, lm35], { from: 1, to: 38 }),
  potentiometer: make(
    "potentiometer",
    "Potenciómetro en GP26",
    [v33Top, gndTop, potentiometer],
    { from: 1, to: 44 },
  ),
  soil: make("soil", "Sonda de suelo en GP26", [v33Top, gndTop, soil], { from: 1, to: 24 }),
  ds18b20: make("ds18b20", "DS18B20 en GP16", [v33Top, gndTop, ds18b20], { from: 1, to: 32 }),
  dht11: make(
    "dht11",
    "DHT11 en GP15",
    [v33Top, v33Bottom, bridge("bp"), gndBottom, bridge("bn"), dht11],
    { from: 1, to: 52 },
  ),
  rain: make("rain", "Sensor de lluvia en GP14", [v33Top, v33Bottom, gndBottom, rain], {
    from: 1,
    to: 26,
  }),
  water: make("water", "Sensor de nivel en GP28", [v33Top, gndTop, water], { from: 1, to: 20 }),
  hcsr04: make(
    "hcsr04",
    "HC-SR04 con divisor en GP17 y GP18",
    [gndBottom, bridge("bn"), gndTop, bridge("tn"), hcsr04],
    { from: 1, to: 63 },
  ),
  pir: make("pir", "PIR HC-SR501 en GP19", [gndTop, pir], { from: 1, to: 26 }),
  /** Etapa 7: todo lo anterior a la vez, cada pieza en el lugar que ya ocupaba. */
  station: make(
    "station",
    "Estación de planta completa",
    [
      v33Top,
      gndTop,
      gndBottom,
      v33Bottom,
      bridge("tn"),
      bridge("bp"),
      bridge("bn"),
      led,
      buzzer,
      soil,
      ldr,
      water,
      ds18b20,
      dht11,
      rain,
      hcsr04,
      pir,
    ],
    { from: 1, to: 63 },
  ),
} satisfies Record<string, Circuit>;

export type CircuitId = keyof typeof circuits;
