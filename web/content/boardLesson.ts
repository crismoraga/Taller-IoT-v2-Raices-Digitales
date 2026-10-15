import type { Board } from "../lib/context";
import type { Lesson, QuizQuestion } from "./types";
import { PICO_PINS } from "../circuit/pico";
import { ARDUINO_STATION_PINS } from "../circuit/boards";

const stationPins = ARDUINO_STATION_PINS;
const pinMaps: Record<string, Record<string, string>> = {
  led: { GP2: "D2" },
  blink: { GP2: "D2" },
  button: { GP4: "D4" },
  button_led: { GP4: "D4", GP2: "D2" },
  soil: { GP26: "A0" },
  ldr: { GP27: "A1", GP26: "A0" },
  water_level: { GP28: "A2", GP26: "A0" },
  lm35: { GP26: "A0" },
  dht11: { GP15: "D4" },
  ds18b20: { GP16: "D5" },
  rain: { GP14: "D6" },
  distance: { GP17: "D7", GP18: "D8" },
  motion: { GP19: "D9" },
  potentiometer: { GP26: "A0" },
  calibration: { GP26: "A0", GP28: "A2" },
  station: stationPins,
};

function question(
  original: QuizQuestion,
  question: string,
  correct: string,
  alternatives: string[],
  explain: string,
): QuizQuestion {
  const options = [...alternatives];
  options.splice(original.answer, 0, correct);
  return { ...original, question, options, explain };
}

/** Board-specific teaching text only. Code, code edits, wiring and the Pico originals remain untouched. */
export function lessonForBoard(lesson: Lesson, board: Board): Lesson {
  if (board === "pico") return lesson;
  const pins = pinMaps[lesson.id] ?? {};
  const prose = (value: string): string => {
    let text = value;
    for (const [pico, arduino] of Object.entries(pins)) {
      if (!pico.startsWith("GP")) continue;
      const physical = PICO_PINS.find((pin) => pin.name === pico)?.physical;
      const suffix = physical
        ? `(?:\\s*[,·]\\s*pin(?:\\s+físico)?\\s*${physical}\\b|\\s*\\(pin(?:\\s+físico)?\\s*${physical}\\))?`
        : "";
      text = text.replace(new RegExp(`\\b${pico}\\b${suffix}`, "g"), arduino);
    }
    return text.replace(/\b([AD]\d+)\s*\/\s*\1\b/g, "$1");
  };
  let adapted: Lesson = {
    ...lesson,
    summary: prose(lesson.summary),
    objective: prose(lesson.objective),
    concept: {
      ...lesson.concept,
      body: lesson.concept.body.map(prose),
      facts: lesson.concept.facts?.map((fact) => ({
        ...fact,
        value: prose(fact.value),
      })),
    },
    why: prose(lesson.why),
    expected: prose(lesson.expected),
    experiment: lesson.experiment.map(prose),
    checkpoint: lesson.checkpoint.map((quiz) => ({
      ...quiz,
      question: prose(quiz.question),
      options: quiz.options.map(prose),
      explain: prose(quiz.explain),
    })),
    troubleshooting: lesson.troubleshooting.map((trouble) => ({
      ...trouble,
      checks: trouble.checks.map(prose),
    })),
  };

  if (lesson.id === "welcome") {
    adapted.summary =
      "Descubre las filas de la protoboard y cómo un jumper las conecta con Arduino.";
    adapted.objective =
      "Reconocer una tira de cinco agujeros y encontrar D2, A0 y GND antes de conectar el LED.";
    adapted.expected =
      "Toca a26 y e26: comparten la misma tira. f26 pertenece al otro lado del canal. Localiza D2, A0 y GND en Arduino y sigue el recorrido de un jumper hasta una fila. Si quieres probar USB ahora, pulsa Cargar en Arduino: el programa se verifica en la memoria de la placa y escribe su saludo en la terminal. La siguiente actividad enciende el LED.";
    adapted.experiment = [
      lesson.experiment[0],
      "Localiza D2, A0 y GND en Arduino. D2 sirve como salida digital; A0 mide una señal analógica; GND completa el circuito. Toca sus nombres en el modelo para encontrarlos.",
      lesson.experiment[2],
    ];
    adapted.modify = lesson.modify.map((task) => ({
      ...task,
      instruction:
        'Agrega Serial.println("Hola, somos el grupo Raíces"); dentro de setup(). Cambia el nombre y vuelve a cargar para recibir tu saludo en la terminal.',
    }));
    adapted.troubleshooting = adapted.troubleshooting.map((trouble) =>
      trouble.symptom.includes("significa un pin")
        ? {
            ...trouble,
            checks: [
              "Toca D2, A0 y GND en el explorador. La etiqueta resalta su conector físico en Arduino.",
              "Busca la misma marca impresa en tu Uno o Nano antes de conectar el cable.",
            ],
          }
        : trouble,
    );
  }

  if (lesson.id === "dht11") {
    adapted.objective =
      "Primero retira el pulsador y su cable de D4. Conserva LED y LDR; conecta el DHT11 para leer temperatura y humedad del aire.";
  }

  if (lesson.id === "led") {
    adapted = {
      ...adapted,
      concept: {
        ...adapted.concept,
        body: [
          "Un LED conduce en un sentido: la corriente entra por la pata larga, sale por la corta y produce luz. El circuito une D2, la resistencia, el LED y GND.",
          "La resistencia de 220 Ω limita la corriente. Con una salida de 5 V y un LED rojo típico pasan aproximadamente 15 mA; el valor exacto depende del LED.",
          "D2 es una salida digital. digitalWrite(2, HIGH) entrega un nivel alto de aproximadamente 5 V; digitalWrite(2, LOW) lo deja en 0 V.",
        ],
        facts: [
          { label: "Pin de Arduino", value: "D2" },
          { label: "Voltaje de la señal", value: "5 V" },
          { label: "Corriente del LED rojo", value: "≈ 15 mA con 220 Ω" },
          { label: "Pata larga", value: "Ánodo (+)" },
        ],
      },
      why: "La corriente sale de D2, pasa por 220 Ω, cruza el LED y vuelve a GND de Arduino. La pata larga queda hacia la resistencia y la corta hacia GND.",
      sampleOutput:
        lesson.arduinoCode?.match(/Serial\.println\("([^"\n]+)"\)/)?.[1] ??
        "LED encendido",
      checkpoint: adapted.checkpoint.map((quiz, index) =>
        index === 0
          ? {
              ...quiz,
              explain:
                "La resistencia limita la corriente del LED y de D2. Con 220 Ω y un LED rojo típico, la salida de 5 V produce aproximadamente 15 mA.",
            }
          : index === 2
            ? question(
                quiz,
                "¿Qué hace digitalWrite(2, LOW)?",
                "Pone D2 en 0 V y apaga el LED",
                [
                  "Desconecta el pin de la placa",
                  "Borra el programa",
                  "Baja el brillo a la mitad",
                ],
                "LOW deja D2 en 0 V. HIGH lo deja aproximadamente en 5 V: la salida digital elige entre esos dos estados.",
              )
            : quiz,
      ),
      troubleshooting: [
        {
          symptom: "El LED no enciende",
          checks: [
            "Sigue D2 → 220 Ω → pata larga del LED → pata corta → GND.",
            "Comprueba que cada extremo coincide con A/B en el diagrama de tu Arduino.",
            "La resistencia debe compartir una tira con la pata larga y otra con el cable de D2.",
          ],
        },
        {
          symptom: "El LED enciende muy tenue",
          checks: [
            "Comprueba las bandas: 220 Ω es rojo, rojo, café; 10 kΩ es café, negro, naranja.",
            "Prueba el LED rojo y compara su brillo con otro color.",
          ],
        },
        {
          symptom: "No se puede cargar el programa",
          checks: [
            "Conecta tu Arduino por USB desde el taller.",
            "Cierra Arduino IDE u otro monitor que tenga abierto el mismo puerto.",
            "Si usas Nano, confirma el bootloader del modelo en Estación.",
          ],
        },
      ],
    };
  }
  if (lesson.id === "blink") {
    adapted.why =
      "D2 alterna entre 0 V y 5 V. La resistencia y el LED conservan el mismo circuito; el sketch cambia el ritmo con un intervalo en milisegundos.";
    adapted.expected =
      "El LED alterna encendido y apagado; la terminal muestra LED: 1 y LED: 0. Detener carga un programa de reposo. También puedes cargar otro sketch.";
    adapted.experiment = [
      lesson.experiment[0],
      "Usa digitalWrite(2, HIGH), una pausa delay, digitalWrite(2, LOW) y otra pausa más corta. ¿Cómo cambia el ritmo al mantener encendido más tiempo que apagado?",
    ];
  }
  if (lesson.id === "button_led") {
    adapted.checkpoint = adapted.checkpoint.map((quiz) => ({
      ...quiz,
      question: quiz.question.replace("not pressed", "!pressed"),
      explain: quiz.explain.replace("not convierte", "! convierte"),
    }));
  }
  if (lesson.id === "lm35") {
    adapted.why =
      "El LM35 se alimenta a 5 V y entrega 10 mV por grado. El sketch convierte analogRead(A0) con 5.0 / 1023.0 y multiplica el voltaje por cien. La referencia real introduce error: compara con una medida conocida.";
    adapted.concept.facts = adapted.concept.facts?.map((fact) =>
      fact.label === "Alimentación" ? { ...fact, value: "5 V" } : fact,
    );
  }
  if (lesson.id === "led_onboard") {
    adapted.concept = {
      ...adapted.concept,
      body: [
        "Arduino trae una luz integrada. LED_BUILTIN nombra esa salida: una instrucción puede encenderla sin añadir piezas.",
        "digitalWrite(LED_BUILTIN, HIGH) la enciende y LOW la apaga. El mensaje de Serial.println es independiente de esa orden.",
      ],
      facts: [
        { label: "Luz integrada", value: "LED_BUILTIN" },
        { label: "Encender / apagar", value: "HIGH / LOW" },
      ],
    };
    adapted.checkpoint = adapted.checkpoint.map((quiz, index) =>
      index === 0
        ? question(
            quiz,
            "¿Qué nombra LED_BUILTIN en Arduino?",
            "Su LED integrado",
            [
              "Cualquier LED de la protoboard",
              "El sensor de humedad",
              "Una entrada analógica",
            ],
            "LED_BUILTIN corresponde a la salida integrada del modelo. El LED externo usa D2 en la siguiente actividad.",
          )
        : {
            ...quiz,
            question: quiz.question.replace("print", "Serial.println"),
          },
    );
    adapted.troubleshooting = [
      {
        symptom: "La luz integrada no cambia",
        checks: [
          "Comprueba que elegiste Uno o Nano y cargaste el sketch con LED_BUILTIN.",
          "Usa HIGH para encender y LOW para apagar; cambiar el mensaje no modifica la luz.",
        ],
      },
    ];
  }
  if (["soil", "water_level", "ldr"].includes(lesson.id)) {
    adapted.concept.facts = adapted.concept.facts?.map((fact) =>
      fact.label === "Pico raw"
        ? { label: "Arduino raw", value: "0–1023" }
        : fact,
    );
    if (lesson.id === "soil") {
      adapted.objective =
        "Leer la entrada A0 y observar cómo cambia la señal entre tierra seca y húmeda.";
      adapted.why =
        "A0 convierte el voltaje de la sonda en un número de 0 a 1023, con la referencia de 5 V del Uno/Nano. La sonda conserva su alimentación de 3,3 V; su rango útil se aprende con dos referencias físicas propias.";
      adapted.expected =
        "Este ejemplo imprime solo suelo: una línea JSON por segundo con raw de 0 a 1023. Conserva la LDR y el DHT11 conectados. Compara tierra seca y húmeda a la misma profundidad; el porcentaje queda vacío hasta calibrar y reinstalar la estación con la nueva sonda.";
    }
  }
  if (lesson.id === "potentiometer") {
    adapted.summary =
      "Gira un potenciómetro y descubre cómo cambia la lectura de A0.";
    adapted.concept = {
      ...adapted.concept,
      body: [
        "El potenciómetro reparte el voltaje entre dos extremos: 5 V y GND. La pata central, el cursor, entrega un punto intermedio que cambia al girar.",
        "A0 convierte ese voltaje en un número de 0 a 1023. Cerca de GND se acerca a cero; cerca de 5 V se acerca a 1023.",
      ],
      facts: [
        { label: "Resistencia total", value: "10 kΩ" },
        { label: "Extremos", value: "5 V y GND" },
        { label: "Cursor", value: "A0" },
        { label: "Lectura", value: "0–1023" },
      ],
    };
    adapted.why =
      "Los extremos van a 5 V y GND. El cursor llega a A0, que lee su posición con la referencia de 5 V de Arduino.";
    adapted.expected =
      "Al girar, aparecen valores entre 0 y 1023 cada 200 ms. El sketch imprime analogRead(A0).";
    adapted.sampleOutput = "12\n245\n512\n1018";
    adapted.checkpoint = adapted.checkpoint.map((quiz, index) =>
      index === 0
        ? {
            ...quiz,
            options: quiz.options.map((option, at) =>
              at === quiz.answer
                ? "Cambia de forma continua entre 0 V y 5 V"
                : option,
            ),
            explain:
              "El cursor entrega un voltaje entre los extremos de GND y 5 V.",
          }
        : index === 1
          ? question(
              quiz,
              "¿Qué lee A0 cuando el cursor está cerca del extremo de 5 V?",
              "Un número cercano a 1023",
              [
                "Un número cercano a 65535",
                "Siempre cero",
                "La temperatura del potenciómetro",
              ],
              "La conversión analógica de Uno/Nano usa una escala de 0 a 1023 con su referencia de 5 V.",
            )
          : {
              ...quiz,
              explain:
                "El cursor debe llegar a A0. Los extremos van a 5 V y GND, en tiras distintas.",
            },
    );
    adapted.troubleshooting = [
      {
        symptom: "La lectura no cambia al girar",
        checks: [
          "Sigue el cable del cursor hasta A0 usando el diagrama de tu Arduino.",
          "Comprueba que los extremos llegan a 5 V y GND y están en tiras distintas.",
          "A0 debe recibir solo el cursor durante esta actividad; retira la señal de suelo si la probaste antes.",
        ],
      },
    ];
  }
  if (lesson.id === "distance") {
    adapted.summary = "Cronometra un eco con TRIG en D7 y ECHO en D8.";
    adapted.objective =
      "Medir el tiempo de ida y vuelta del sonido y convertirlo en distancia.";
    adapted.concept = {
      ...adapted.concept,
      body: [
        lesson.concept.body[0],
        "TRIG en D7 ordena la medición y ECHO en D8 indica su duración. En Uno/Nano AVR ambos trabajan con lógica de 5 V; ECHO llega directamente a D8.",
      ],
      facts: [
        { label: "TRIG", value: "D7" },
        { label: "ECHO", value: "D8 directo" },
        { label: "Alimentación", value: "5 V y GND" },
        { label: "Espera de eco", value: "30 ms máximo" },
      ],
    };
    adapted.why =
      "D7 envía el disparo y D8 mide el pulso de ECHO con pulseIn. El módulo y Uno/Nano AVR usan lógica de 5 V. La distancia divide por dos el tiempo del sonido porque el eco hace ida y vuelta.";
    adapted.challenge = {
      ...lesson.challenge,
      prompt:
        "Explica qué pasaría con el tiempo de ECHO si duplicas la distancia al objeto.",
      hints: [
        "El sonido debe recorrer dos veces la distancia entre sensor y objeto.",
        "Si la velocidad del sonido se mantiene, duplicar el camino duplica aproximadamente el tiempo.",
      ],
    };
    adapted.checkpoint = adapted.checkpoint.map((quiz, index) =>
      index === 0
        ? question(
            quiz,
            "¿Dónde llega ECHO en este montaje Uno/Nano AVR?",
            "Directamente a D8",
            [
              "A una entrada de alimentación",
              "Al mismo pin D7 que TRIG",
              "A la entrada A0 del suelo",
            ],
            "ECHO y D8 usan niveles de 5 V en este Arduino. TRIG mantiene una conexión independiente en D7.",
          )
        : {
            ...quiz,
            options: quiz.options.map((option) =>
              option === "Porque el GPIO es de 3,3 V"
                ? "Porque cambia el voltaje de alimentación"
                : option,
            ),
          },
    );
    adapted.troubleshooting = adapted.troubleshooting.map((trouble) => ({
      ...trouble,
      checks: trouble.checks.map((check) =>
        check.includes("divisor")
          ? "Sigue VCC a 5 V, GND a GND, TRIG a D7 y ECHO directamente a D8 en el diagrama de tu Arduino."
          : check,
      ),
    }));
  }
  if (lesson.id === "cloud") {
    adapted.summary =
      "Envía las lecturas de Arduino al servidor mediante USB y observa tu planta en vivo.";
    adapted.objective =
      "Instalar el programa de estación y recibir dos lecturas reales en Mi planta usando el puente USB del computador.";
    adapted.concept = {
      ...adapted.concept,
      body: [
        lesson.concept.body[0],
        "Arduino mide y entrega sus mensajes por USB. Este navegador usa la conexión a Internet del PC para enviarlos al servidor; el sketch no añade Wi-Fi a Uno/Nano.",
        lesson.concept.body[2],
      ],
      facts: [
        { label: "Placa → PC", value: "USB" },
        { label: "PC → servidor", value: "Internet del computador / HTTPS" },
        { label: "Puente", value: "Taller abierto en este navegador" },
        { label: "Cadencia habitual", value: "5 s" },
      ],
    };
    adapted.why =
      "El sketch contiene los sensores, referencias y vínculo de tu grupo. Arduino entrega lecturas por USB; el navegador las transmite por Internet al servidor. Mantén el PC conectado a Internet y esta página abierta para conservar ese puente.";
    adapted.expected =
      "En Estación conecta USB, activa Suelo e instala el programa de Arduino con tus referencias. Mantén esta página abierta. En Mi planta confirma dos lecturas recientes de origen hardware, crea una regla, observa alerta y recuperación y exporta el CSV.";
    adapted.modify = lesson.modify.map((task, index) =>
      index === 0
        ? {
            ...task,
            instruction:
              "En Estación conecta Arduino por USB, selecciona los sensores e instala su sketch. Deja el taller abierto y observa el viaje de la lectura hasta Mi planta.",
          }
        : task,
    );
    adapted.experiment = [
      "Señala cada salto real: sensor → Arduino → USB → navegador del PC → Internet → servidor → Mi planta.",
      lesson.experiment[1],
      "Exporta el CSV de tu grupo y explica una conexión, una línea modificada y cómo el computador transmitió tus lecturas.",
    ];
    adapted.troubleshooting = adapted.troubleshooting.filter(
      (trouble) => !trouble.symptom.includes("Wi-Fi"),
    );
  }
  if (lesson.id === "station") {
    adapted.expected =
      "Coloca la LDR hacia la luz y el DHT11 al aire junto a la maceta. Confirma los sensores montados y pulsa Instalar sensores conectados. La terminal y Mi planta reciben las lecturas de Arduino por USB; mantén esta página abierta. Añade la sonda de suelo en la siguiente actividad y reinstala al incorporar cada sensor.";
  }
  if (lesson.id === "calibration") {
    adapted.expected =
      "Con Arduino conectado y la estación ejecutándose, toma una lectura RAW USB reciente para Seco y otra para Húmedo, o escríbelas desde la terminal. Usa valores enteros de 0 a 1023 separados al menos 8 unidades. Guarda y reinstala la estación para aplicar las referencias.";
    adapted.why =
      "A0 mide voltaje. Dos condiciones físicas crean una escala propia del montaje; la herramienta toma el RAW real que llega por USB o el que escribes de la terminal. Guardar conserva las referencias del grupo y reinstalar las incorpora a la estación.";
    adapted.modify = lesson.modify.map((task, index) =>
      index === 0 && task.arduino
        ? {
            ...task,
            arduino: {
              ...task.arduino,
              instruction:
                "Con la estación Arduino ejecutándose, toma la referencia seca por USB. Cambia a tierra húmeda y toma la segunda referencia. También puedes escribir dos RAW del ejemplo individual. Guarda y reinstala la estación.",
            },
          }
        : task,
    );
    adapted.troubleshooting = adapted.troubleshooting.map((trouble) =>
      trouble.symptom.startsWith("Capturar")
        ? {
            symptom: "No llega una referencia USB",
            checks: [
              "Conecta Arduino, activa el sensor y ejecuta la estación para recibir un RAW reciente.",
              "Puedes copiar RAW del ejemplo individual y escribirlo. Mantén la misma placa y sonda para ambas referencias.",
            ],
          }
        : trouble,
    );
  }
  // This checkpoint teaches the comparator rather than repeating a workspace warning.
  if (lesson.id === "rain")
    adapted.checkpoint = adapted.checkpoint.map((quiz, index) =>
      index === 1
        ? question(
            quiz,
            "¿Qué cambia al girar el trimmer del LM393?",
            "El umbral que convierte la señal en seco o mojado",
            [
              "La cantidad de agua medida en litros",
              "La entrada D6 de Arduino",
              "La conexión Wi-Fi de la placa",
            ],
            "El trimmer ajusta cuándo el comparador cambia DO. Una gota puede activar o no el estado según ese umbral.",
          )
        : quiz,
    );
  return adapted;
}
