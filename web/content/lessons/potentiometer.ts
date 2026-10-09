import type { Lesson } from "../types";

/** Zona Explora: un potenciómetro como divisor ajustable de 3,3 V. */
export const potentiometer: Lesson = {
  id: "potentiometer",
  stage: "explora",
  title: "Una perilla, miles de valores",
  summary:
    "Gira un potenciómetro y mira cómo cambia el número que lee la Pico.",
  duration: 6,
  icon: "sparkle",

  objective:
    "Montar un potenciómetro de 10 kΩ en la protoboard y leer su posición con la entrada analógica GP26.",

  materials: [
    {
      name: "Potenciómetro de 10 kΩ",
      qty: 1,
      note: "Tiene una perilla y tres patas. La del centro es el cursor.",
    },
    {
      name: "Cables de conexión (jumpers)",
      qty: 3,
      note: "Uno rojo, uno amarillo y uno negro.",
    },
    { name: "Pico W en la protoboard", qty: 1 },
  ],

  concept: {
    title: "¿Qué hace un potenciómetro?",
    body: [
      "Imagina una regla con un marcador que puedes deslizar. Un extremo vale 0 V, el otro vale 3,3 V, y el marcador da cualquier valor intermedio. Eso es un potenciómetro: una resistencia con una perilla que mueve ese marcador.",
      "La pata del centro es el cursor. Al girar la perilla, el cursor se acerca a un extremo o al otro, y el voltaje que entrega cambia de forma continua.",
      "La Pico convierte ese voltaje en un número con su conversor analógico-digital (ADC). Como el ADC trabaja de 0 a 65535 en MicroPython, cada posición de la perilla deja un número distinto.",
    ],
    facts: [
      { label: "Resistencia total", value: "10 kΩ" },
      { label: "Voltaje en los extremos", value: "3,3 V y GND" },
      { label: "Entrada usada", value: "GP26 (pin 31), ADC0" },
      { label: "Rango del número", value: "0 a 65535" },
    ],
  },

  safety: [
    "Desconecta el cable USB antes de mover cables o piezas.",
    "Usa 3,3 V en los extremos del potenciómetro. Nunca conectes 5 V a la Pico.",
  ],

  circuit: "potentiometer",
  arduino: {
    rows: [
      {
        from: "Extremo 1 del potenciómetro",
        to: "5V",
        color: "naranja",
        warning: "Solo si tu placa es Arduino Uno o Nano, que trabaja a 5 V.",
      },
      { from: "Cursor (pata del centro)", to: "A0", color: "amarillo" },
      { from: "Extremo 2 del potenciómetro", to: "GND", color: "negro" },
    ],
    notes: [
      "En Arduino Uno y Nano la entrada A0 lee de 0 a 5 V. El rango del número va de 0 a 1023.",
    ],
  },

  why: "El cursor entrega un voltaje entre 0 y 3,3 V, y GP26 solo acepta ese rango. Por eso los extremos van a 3,3 V y a GND, y el cursor va a GP26: el voltaje que llega a la entrada depende de la posición de la perilla.",

  code: `from machine import ADC, Pin
from time import sleep

pot = ADC(Pin(26))           # GP26, entrada analógica ADC0
while True:
    print("Posición:", pot.read_u16(), "/ 65535")
    sleep(0.2)
`,
  arduinoCode: `void setup() {
  Serial.begin(115200);
}
void loop() {
  Serial.println(analogRead(A0)); // A0 lee el cursor, entre 0 y 1023
  delay(200);
}
`,
  codeNotes: [
    {
      line: "pot = ADC(Pin(26))",
      note: "Crea la lectura analógica en GP26. Ahí llega el voltaje del cursor.",
    },
    {
      line: "pot.read_u16()",
      note: "Devuelve un número entre 0 y 65535: 0 cuando el cursor está en GND y casi 65535 cuando está en 3,3 V.",
    },
  ],

  expected:
    "Al girar la perilla, los números cambian de forma continua, desde cerca de 0 hasta cerca de 65535. Los valores se imprimen cada 0,2 s.",
  sampleOutput: `Posición: 412 / 65535
Posición: 1038 / 65535
Posición: 30871 / 65535
Posición: 64977 / 65535`,

  modify: [
    {
      title: "Cambia el intervalo de lectura",
      instruction:
        "Cambia el 0.2 por 1 y vuelve a ejecutar. Mueve la perilla despacio y cuenta cuántas lecturas ves.",
      find: "sleep(0.2)",
      replace: "sleep(1)",
      observe:
        "La terminal imprime una línea por segundo. El valor sigue siendo el mismo voltaje, solo cambia la frecuencia.",
      arduino: {
        instruction: "Cambia delay(200) por delay(1000).",
        find: "delay(200)",
        replace: "delay(1000)",
      },
    },
    {
      title: "Muestra un porcentaje",
      instruction:
        'Reemplaza el print por dos líneas: calcula porcentaje = pot.read_u16() * 100 // 65535 y muéstralo con print("Posición:", porcentaje, "%").',
      find: 'print("Posición:", pot.read_u16(), "/ 65535")',
      observe:
        "El número ya no llega a 65535. Ahora va de 0 a 100 y es más fácil de leer.",
      arduino: {
        instruction:
          "Reemplaza la lectura impresa por analogRead(A0) * 100L / 1023. El sufijo L evita overflow al multiplicar.",
        find: "Serial.println(analogRead(A0));",
        replace: "Serial.println(analogRead(A0) * 100L / 1023);",
      },
    },
  ],

  experiment: [
    "Gira la perilla hasta el tope en un sentido y después en el otro. ¿Cuál de los dos extremos da el número más cercano a cero? ¿Por qué?",
    "Deja la perilla en el centro. ¿El número queda en la mitad del rango? Compara con un compañero que tenga otro potenciómetro del mismo modelo.",
    "Mueve la perilla muy despacio y observa si los números saltan. ¿Qué pasa con la entrada cuando el voltaje cambia de forma gradual?",
  ],

  challenge: {
    prompt:
      "Usa la perilla para controlar el ritmo de la terminal: mientras más girada esté la perilla, más rápido se imprime cada lectura.",
    hints: [
      "Necesitas que el tiempo de espera del sleep cambie según la lectura del potenciómetro.",
      "Calcula un tiempo entre 0,05 s y 0,5 s a partir del valor que devuelve read_u16().",
      "Usa una variable: retardo = 0.5 - 0.45 * (pot.read_u16() / 65535). Después escribe sleep(retardo) al final del bucle.",
    ],
    solution: `from machine import ADC, Pin
from time import sleep

pot = ADC(Pin(26))
while True:
    valor = pot.read_u16()
    retardo = 0.5 - 0.45 * (valor / 65535)
    print("Lectura:", valor, "/ pausa:", round(retardo, 2), "s")
    sleep(retardo)
`,
    arduino: {
      hints: [
        "Haz que la pausa disminuya a medida que crece analogRead(A0).",
        "Construye un intervalo entre 500 y 50 milisegundos con la escala de 0 a 1023.",
        "Usa retardo = 500 - valor * 450L / 1023; el sufijo L evita overflow. Después llama delay(retardo).",
      ],
      solution: `void setup() { Serial.begin(115200); }
void loop() {
  int valor = analogRead(A0);
  unsigned long retardo = 500 - valor * 450L / 1023;
  Serial.print("Lectura: "); Serial.print(valor);
  Serial.print(" / pausa ms: "); Serial.println(retardo);
  delay(retardo);
}
`,
    },
  },

  checkpoint: [
    {
      question: "¿Qué pasa con el voltaje del cursor cuando giras la perilla?",
      options: [
        "Cambia de forma continua entre 0 V y 3,3 V",
        "Salta siempre entre 0 V y 5 V",
        "No cambia, porque la perilla solo cambia la resistencia",
        "Se queda fijo en 1,5 V",
      ],
      answer: 0,
      explain:
        "El cursor reparte el voltaje entre los dos extremos. Según dónde esté, entrega cualquier valor entre 0 V y 3,3 V.",
    },
    {
      question:
        "¿Por qué los extremos del potenciómetro van a 3,3 V y no a 5 V?",
      options: [
        "Porque 5 V da una lectura más precisa",
        "Porque los pines GP de la Pico solo soportan 3,3 V, y el cursor llega a una de esas entradas",
        "Porque el potenciómetro se quema con 3,3 V",
        "Porque la Pico no puede leer números de cuatro cifras",
      ],
      answer: 1,
      explain:
        "El cursor llega directo a GP26. Si recibiera 5 V, la entrada se dañaría. Por eso el divisor usa el mismo voltaje que la Pico.",
    },
    {
      question:
        "Si la lectura se queda en 0 aunque gires la perilla, ¿qué revisas primero?",
      options: [
        "Que el cursor esté conectado a GP26 y no a un extremo",
        "Que la terminal tenga la fuente en negro",
        "Que el potenciómetro sea de color negro",
        "Que el sleep esté en 0,2 s",
      ],
      answer: 0,
      explain:
        "Si el cursor no llega a GP26, la entrada no ve ningún voltaje que cambie. Revisa el cable amarillo, que debe salir de j39 a j10.",
    },
  ],

  troubleshooting: [
    {
      symptom: "La lectura se queda fija y no cambia al girar la perilla",
      checks: [
        "El cable amarillo no está en j10. Revisa que salga de j39, el cursor, y llegue a j10 (GP26).",
        "Las tres patas del potenciómetro no están en f37, f39 y f41. Si una pata está fuera, el divisor no funciona.",
        "Se quedó conectado el cable de la sonda de suelo en j10. Retíralo antes de usar este montaje.",
      ],
    },
    {
      symptom: "La lectura siempre da 0 o siempre da casi 65535",
      checks: [
        "Un extremo del potenciómetro no está en GND. Revisa que el cable negro salga de j41 y llegue a la línea azul de arriba.",
        "El cable rojo no está en j37. Si quedó en otro agujero, el extremo no recibe 3,3 V.",
        "Hay un cable de 5 V en el montaje. Quítalo: este potenciómetro solo usa 3,3 V.",
      ],
    },
    {
      symptom: "La terminal no muestra nada o da error al ejecutar",
      checks: [
        "La placa no está conectada. Presiona Conectar placa y elige el puerto de la Pico W.",
        "El cable USB es solo de carga. Prueba con otro cable que transmita datos.",
        "Otro programa, como Thonny, tiene abierto el puerto. Ciérralo y vuelve a ejecutar.",
      ],
    },
  ],
};
