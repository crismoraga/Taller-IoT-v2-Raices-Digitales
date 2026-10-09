import type { Lesson } from "../types";

/** Lección de referencia: el resto de las actividades sigue esta misma estructura y tono. */
export const led: Lesson = {
  id: "led",
  stage: 1,
  essential: true,
  title: "Tu primera señal",
  summary: "Arma un circuito con un LED y enciéndelo desde tu código.",
  duration: 8,
  icon: "lightbulb",

  objective:
    "Armar un circuito con LED y resistencia en la protoboard, y encenderlo y apagarlo con una instrucción.",

  materials: [
    {
      name: "LED rojo de 5 mm",
      qty: 1,
      note: "También sirve el amarillo. El azul brilla menos con 3,3 V.",
    },
    {
      name: "Resistencia de 220 Ω",
      qty: 1,
      note: "Bandas rojo, rojo, café y dorado.",
    },
    {
      name: "Cables macho-macho",
      qty: 3,
      note: "Idealmente uno negro y dos de otro color.",
    },
    { name: "Pico W en la protoboard", qty: 1 },
  ],

  concept: {
    title: "¿Qué es un LED y por qué lleva resistencia?",
    body: [
      "Un LED es como una calle de un solo sentido para la electricidad: la corriente entra por la pata larga, sale por la corta y, al pasar, produce luz. En este circuito de 3,3 V con resistencia, invertirlo normalmente impide encender; no pruebes esa inversión con otras tensiones ni sin protección.",
      "El LED no sabe frenar la corriente. Sin ayuda, dejaría pasar tanta que se quemaría o dañaría el pin de la Pico. La resistencia es ese freno: con 220 Ω pasan unos 7 mA, suficiente para verlo brillar y seguro para la placa.",
      "El pin GP2 es una salida digital. Tu programa decide si entrega 3,3 V (un 1) o 0 V (un 0). Eso es todo lo que hace falta para que el software controle algo del mundo físico.",
    ],
    facts: [
      { label: "Pin de la Pico", value: "GP2 (pin 4)" },
      { label: "Voltaje de la señal", value: "3,3 V" },
      { label: "Corriente del LED", value: "≈ 7 mA" },
      { label: "Pata larga", value: "Ánodo (+)" },
    ],
  },

  safety: [
    "Desconecta el cable USB antes de mover cables o piezas.",
    "Nunca conectes un LED sin su resistencia.",
  ],

  circuit: "led",
  arduino: {
    rows: [
      { from: "Pin D2", to: "Resistencia de 220 Ω", color: "verde" },
      { from: "Resistencia de 220 Ω", to: "Pata larga del LED (ánodo)" },
      { from: "Pata corta del LED (cátodo)", to: "GND", color: "negro" },
    ],
    notes: [
      "En Arduino Uno y Nano la salida es de 5 V. Con 220 Ω el LED recibe unos 15 mA: sigue siendo seguro.",
    ],
  },

  why: "La corriente necesita un camino cerrado: sale de GP2, pasa por la resistencia, cruza el LED y vuelve a la Pico por GND. Si el camino se corta en cualquier punto, o el LED está al revés, no circula y no hay luz.",

  code: `from machine import Pin

led = Pin(2, Pin.OUT)   # GP2 trabajará como salida
led.value(1)            # 1 enciende, 0 apaga
print("LED encendido en GP2")
`,
  arduinoCode: `void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);        // D2 trabajará como salida
  digitalWrite(2, HIGH);     // HIGH enciende, LOW apaga
  Serial.println("LED encendido en D2");
}

void loop() {}
`,
  codeNotes: [
    {
      line: "from machine import Pin",
      note: "Trae la herramienta para controlar los pines de la placa.",
    },
    {
      line: "led = Pin(2, Pin.OUT)",
      note: "Le pone nombre al pin GP2 y lo configura como salida.",
    },
    {
      line: "led.value(1)",
      note: "Pone el pin en 3,3 V. Ahí empieza a circular corriente y el LED enciende.",
    },
  ],

  expected:
    "Al presionar Ejecutar, el LED físico se enciende y queda encendido. En la terminal aparece el mensaje del programa. La comprobación termina cuando cambias el estado desde el código y ves apagarse ese mismo LED; cambiar solo el mensaje no cambia la luz.",
  sampleOutput: "LED encendido en GP2",

  modify: [
    {
      title: "Apágalo sin tocar un cable",
      instruction: "Cambia el 1 por un 0 y vuelve a ejecutar.",
      find: "led.value(1)",
      replace: "led.value(0)",
      observe:
        "El LED se apaga. El circuito es el mismo: solo cambió el software.",
      arduino: {
        instruction:
          "Cambia digitalWrite(2, HIGH) por digitalWrite(2, LOW) y vuelve a compilar y cargar.",
        find: "digitalWrite(2, HIGH)",
        replace: "digitalWrite(2, LOW)",
      },
    },
    {
      title: "Cambia el mensaje",
      instruction:
        "Escribe el nombre de tu grupo dentro de las comillas del print.",
      find: 'print("LED encendido en GP2")',
      observe:
        "La terminal muestra tu texto. Así se comunica la placa contigo.",
      arduino: {
        instruction:
          "Escribe el nombre de tu grupo dentro del Serial.println. Vuelve a compilar y cargar.",
        find: 'Serial.println("LED encendido en D2")',
      },
    },
  ],

  experiment: [
    "Con el USB desconectado, gira el LED: pata corta en d26 y pata larga en d27. ¿Qué pasa al ejecutar? ¿Por qué?",
    "Prueba con el LED amarillo y con el azul. ¿Brillan igual? El código no cambió: cambió el componente.",
    "Predice qué pasaría si faltara el cable de GND. Para comprobarlo, quita USB, retira ese cable y vuelve a alimentar solo tras revisar el montaje. Después quita USB y repón el cable.",
  ],

  challenge: {
    prompt:
      "Haz que el LED se encienda, espere dos segundos y se apague solo, sin volver a presionar Ejecutar.",
    hints: [
      "Necesitas que el programa haga una pausa entre encender y apagar.",
      "La función sleep, del módulo time, detiene el programa la cantidad de segundos que le indiques.",
      "Agrega arriba «from time import sleep». Después de encender, escribe sleep(2) y luego led.value(0).",
    ],
    solution: `from machine import Pin
from time import sleep

led = Pin(2, Pin.OUT)
led.value(1)
sleep(2)
led.value(0)
print("Listo: encendí dos segundos y apagué")
`,
    arduino: {
      hints: [
        "Una pausa entre las dos órdenes permite mantener la luz encendida un tiempo.",
        "delay usa milisegundos: dos segundos equivalen a 2000.",
        "Dentro de setup usa digitalWrite(2, HIGH), delay(2000) y digitalWrite(2, LOW). Deja loop vacío para hacerlo una sola vez.",
      ],
      solution: `void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  digitalWrite(2, HIGH);
  delay(2000);
  digitalWrite(2, LOW);
  Serial.println("Listo: encendi dos segundos y apague");
}
void loop() {}
`,
    },
  },

  checkpoint: [
    {
      question: "¿Para qué sirve la resistencia de 220 Ω?",
      options: [
        "Para que el LED brille con más fuerza",
        "Para limitar la corriente y proteger al LED y al pin",
        "Para cambiar el color de la luz",
        "Para almacenar energía cuando se apaga",
      ],
      answer: 1,
      explain:
        "El LED no limita su propia corriente. La resistencia la deja en unos 7 mA, un valor seguro para el LED y para el pin GP2.",
    },
    {
      question: "Armaste todo y el LED no enciende. ¿Qué revisas primero?",
      options: [
        "Que la pata larga del LED esté del lado de la resistencia",
        "Que el LED sea de color rojo",
        "Que la placa esté conectada a Internet",
        "Que la resistencia no esté al revés",
      ],
      answer: 0,
      explain:
        "El LED conduce en un solo sentido: la pata larga (ánodo) va hacia la señal. La resistencia, en cambio, no tiene polaridad.",
    },
    {
      question: "¿Qué hace led.value(0)?",
      options: [
        "Desconecta el pin de la placa",
        "Borra el programa",
        "Pone el pin GP2 en 0 V, así que deja de circular corriente",
        "Baja el brillo a la mitad",
      ],
      answer: 2,
      explain:
        "Una salida digital solo tiene dos estados: 1 (3,3 V) y 0 (0 V). Con 0 V en ambos extremos del circuito no hay corriente.",
    },
  ],

  troubleshooting: [
    {
      symptom: "El LED no enciende",
      checks: [
        "Desconecta USB antes de revisar o corregir cualquiera de estas conexiones. Si usas Uno/Nano, sigue su tabla D2 → 220 Ω → ánodo → cátodo → GND.",
        "El LED está al revés: la pata larga va en d26, junto a la resistencia.",
        "El cable verde no está en a4. Cuenta desde el USB: a1 es GP0, a2 es GP1, a3 es GND y a4 es GP2.",
        "Falta el cable negro entre a27 y el riel azul, o el cable entre a3 y el riel azul.",
        "La resistencia y la pata larga no comparten el número 26.",
      ],
    },
    {
      symptom: "El LED enciende muy tenue",
      checks: [
        "Usaste una resistencia de 10 kΩ (café, negro, naranja) en vez de 220 Ω (rojo, rojo, café).",
        "Es un LED azul: con 3,3 V brilla menos. Prueba con el rojo.",
      ],
    },
    {
      symptom: "El botón Ejecutar está desactivado o da error",
      checks: [
        "La placa no está conectada: presiona «Conectar placa» y elige el puerto de la Pico.",
        "El cable USB es solo de carga. Prueba con otro cable.",
        "Otro programa, como Thonny, tiene abierto el puerto. Ciérralo.",
      ],
    },
  ],
};
