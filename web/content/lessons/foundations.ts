import { activity, quiz, serialTrouble } from "../library";
import type { Lesson } from "../types";

export const welcome = activity("welcome", {
  stage: 0,
  essential: true,
  title: "De una señal a una planta conectada",
  summary:
    "Conoce tu placa, la protoboard y el viaje que harán los datos de tu planta.",
  duration: 5,
  icon: "rocket",
  objective:
    "Reconocer alimentación, señales y conexiones antes de ejecutar tu primer programa real.",
  materials: [
    { name: "Placa con conexión USB", qty: 1 },
    {
      name: "Cable USB de datos",
      qty: 1,
      note: "Un cable que solo carga no sirve para programar.",
    },
    { name: "Protoboard de 830 puntos", qty: 1 },
    { name: "Planta y kit de tu grupo", qty: 1 },
  ],
  concept: {
    title: "¿Cómo llega una planta a una pantalla?",
    body: [
      "Una planta no habla en números. Un sensor transforma una condición física, como la humedad, en una señal. La placa lee esa señal y tu programa le da significado.",
      "La red transporta las lecturas al servidor. La web las muestra para que puedas decidir: observar, revisar o regar a mano. Ese encuentro entre electrónica, código y comunicaciones es una parte de la Ingeniería Civil Telemática.",
      "Hoy avanzas en seis pasos: reconoces la placa, enciendes un LED, cambias su ritmo, lees el suelo, calibras y conectas la estación. La ruta completa agrega botones, sonido y más sensores cuando tengas tiempo.",
    ],
    facts: [
      { label: "Ruta exprés", value: "60 minutos" },
      { label: "Grupo", value: "Una estación propia" },
      { label: "Cadena", value: "Sensor → código → red" },
      { label: "Primero", value: "USB y seguridad" },
    ],
  },
  safety: [
    "Desconecta el USB antes de mover componentes. Alimenta y prueba solo después de revisar el montaje.",
    "Los pines GP de la Pico aceptan hasta 3,3 V. VBUS entrega 5 V y se mantiene separado de los rieles de 3,3 V.",
    "La protoboard y la electrónica quedan lejos del agua. No conectes el soporte de batería de 9 V directamente a sensores o GPIO.",
  ],
  why: "Los cinco agujeros a–e de un mismo número están unidos; f–j forman otro grupo independiente. El canal central los separa. Los rieles largos distribuyen energía y a veces están cortados al centro. Un cable debe unir nodos distintos: poner dos patas en el mismo grupo puede anular el componente.",
  expected:
    "Elige el modelo de tu placa, conecta un USB de datos y autoriza su puerto. Ejecuta: en Pico aparece la identificación de MicroPython. En Uno/Nano aparece el saludo del sketch a 115200 baudios. Antes de avanzar, cada persona señala alimentación, GND y el camino sensor → programa → red → pantalla.",
  codeNotes: [
    {
      line: "import sys",
      note: "Accede a información del MicroPython que está instalado en la placa.",
    },
  ],
  modify: [
    {
      title: "Ponle voz a tu grupo",
      instruction:
        "Agrega al final print(" +
        '"Hola, somos el grupo Raíces"' +
        "). Cambia el nombre y ejecuta otra vez. En el sketch, agrega un Serial.println con tu saludo dentro de setup.",
      observe:
        "Tu placa imprime tu propio mensaje: el editor está ejecutando código real por USB.",
    },
  ],
  experiment: [
    "En el explorador de protoboard, toca a26 y luego e26. ¿Comparten conexión? Ahora compara a26 con f26.",
    "Localiza GP2 y su número físico. ¿Por qué GP2 no es el pin físico 2? Un nombre describe la función; el otro describe la posición.",
    "Reparte roles: una persona cablea, otra programa y otra registra lo observado. Rota después del LED.",
  ],
  challenge: {
    prompt:
      "Dibuja o relata el viaje de una futura medición desde la tierra hasta esta página.",
    hints: [
      "Parte por lo que puede sentir la humedad.",
      "Incluye sensor, placa, programa, red, servidor y pantalla. Di qué hace cada uno.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué agujeros están unidos en una protoboard?",
      "a26, b26, c26, d26 y e26",
      ["a26 y a27", "a26 y f26", "Todos los agujeros de la placa"],
      "Cada tira de cinco agujeros del mismo lado forma un nodo. El canal central separa ese nodo del otro lado.",
    ),
    quiz(
      "¿Cuándo cambias una conexión del circuito?",
      "Con el USB y otras fuentes desconectados",
      [
        "Mientras el programa está corriendo",
        "Solo cuando el LED está encendido",
        "Después de subir el brillo de la pantalla",
      ],
      "Quitar alimentación evita un cortocircuito accidental mientras mueves piezas. Detener el código no quita alimentación al circuito.",
    ),
  ],
  troubleshooting: [
    serialTrouble,
    {
      symptom: "El taller abre, pero no puedes elegir un puerto USB",
      checks: [
        "Para programar usa Chrome o Edge de escritorio y la URL HTTPS del taller. Safari, Firefox y la mayoría de navegadores móviles permiten leer las actividades, pero no este transporte USB.",
        "Si no tienes un computador compatible, trabaja con el de tu grupo o usa la práctica sin hardware. Registra que la ejecución física sigue pendiente.",
      ],
    },
    {
      symptom: "No entiendes qué significa un pin",
      checks: [
        "Toca el pin en el explorador: distingue GP, GND, 3V3 y VBUS.",
        "Cuenta posiciones desde el USB y compara el nombre con la guía antes de conectar.",
      ],
    },
  ],
});

export const onboard: Lesson = {
  id: "led_onboard",
  stage: 1,
  title: "Una luz que ya está en tu placa",
  summary:
    "Enciende el LED integrado para probar el programa antes de armar un circuito.",
  duration: 3,
  icon: "lightbulb",
  objective:
    "Ejecutar una orden sobre el LED integrado y distinguir software de cableado externo.",
  materials: [
    { name: "Raspberry Pi Pico W o placa Uno/Nano", qty: 1 },
    { name: "USB de datos", qty: 1 },
  ],
  concept: {
    title: "Una primera prueba sin cables adicionales",
    body: [
      "La placa trae una luz pequeña. Es como el testigo de un electrodoméstico: te deja comprobar que una instrucción llegó a algo físico.",
      "En Pico W el LED se controla mediante el nombre LED, porque depende del chip inalámbrico. No se debe reemplazar por GP25 como en una Pico sin Wi-Fi. En un Uno/Nano, LED_BUILTIN usa la salida integrada que define su modelo.",
    ],
    facts: [
      { label: "Pico W", value: 'Pin("LED")' },
      { label: "Sketch", value: "LED_BUILTIN" },
    ],
  },
  safety: ["No conectes ningún componente extra para esta prueba."],
  why: "El LED ya incluye las conexiones y el limitador necesarios dentro de la placa. Puedes centrarte en una sola pregunta: ¿el programa cambió su estado? Después construirás tú mismo ese camino con un LED externo.",
  code: `from machine import Pin
led = Pin("LED", Pin.OUT)
led.value(1)
print("LED integrado encendido")
`,
  arduinoCode: `void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("LED integrado encendido");
}
void loop() {}
`,
  codeNotes: [
    {
      line: 'Pin("LED", Pin.OUT)',
      note: "Selecciona el LED integrado de una Pico W, no un pin conectado a la protoboard.",
    },
    { line: "led.value(1)", note: "El valor 1 pide encender; 0 pide apagar." },
  ],
  expected:
    "Se enciende el LED pequeño de la placa y aparece una confirmación en la terminal. El LED externo todavía no está conectado.",
  sampleOutput: "LED integrado encendido",
  modify: [
    {
      title: "Apaga desde el editor",
      instruction:
        "Cambia value(1) por value(0). En el sketch, cambia HIGH por LOW. Ejecuta de nuevo.",
      find: "led.value(1)",
      replace: "led.value(0)",
      observe: "La luz integrada se apaga sin cambiar una conexión.",
      arduino: {
        instruction: "Cambia HIGH por LOW en la orden del LED integrado.",
        find: "digitalWrite(LED_BUILTIN, HIGH)",
        replace: "digitalWrite(LED_BUILTIN, LOW)",
      },
    },
  ],
  experiment: [
    "Ejecuta dos veces el encendido. ¿Dos órdenes de encender producen dos destellos o dejan el mismo estado?",
    "Cambia el mensaje impreso. ¿Cambiar el texto cambia también la luz? Identifica qué línea hace cada cosa.",
  ],
  challenge: {
    prompt:
      "Consigue que el mensaje describa el estado que realmente dejaste en la luz.",
    hints: [
      "La luz y el texto son instrucciones distintas.",
      "Si usas value(0), modifica el print para que diga apagado.",
    ],
    solution: `from machine import Pin
led = Pin("LED", Pin.OUT)
led.value(0)
print("LED integrado apagado")
`,
    arduino: {
      hints: [
        "La luz y el mensaje son órdenes separadas.",
        "Usa LOW para apagar LED_BUILTIN y un Serial.println que describa ese mismo estado.",
      ],
      solution: `void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("LED integrado apagado");
}
void loop() {}
`,
    },
  },
  checkpoint: [
    quiz(
      "¿Qué nombra LED en la Pico W?",
      "Su LED integrado",
      [
        "Cualquier LED de la protoboard",
        "El sensor de humedad",
        "El pin GP25 de todas las placas",
      ],
      "El alias LED corresponde al LED de Pico W. El montaje externo de la siguiente actividad usa GP2.",
    ),
    quiz(
      "Cambiaste solo el mensaje de print. ¿Qué cambia?",
      "El texto de la terminal",
      [
        "El brillo de la luz",
        "La resistencia de la placa",
        "El voltaje del USB",
      ],
      "Imprimir informa lo que el programa escribe. Cambiar el estado eléctrico requiere ejecutar la orden del pin.",
    ),
  ],
  troubleshooting: [
    serialTrouble,
    {
      symptom: "Pin LED no existe o la luz no cambia",
      checks: [
        "Comprueba que es Pico W y que su firmware MicroPython corresponde a Pico W.",
        "Si tu placa es Uno/Nano, selecciona su modelo para cargar el sketch equivalente.",
      ],
    },
  ],
};

export const blink = activity("blink", {
  stage: 1,
  essential: true,
  summary:
    "Conserva tu circuito y escribe su ritmo: rápido, lento o un pulso por segundo.",
  duration: 7,
  icon: "activity",
  circuit: "led",
  concept: {
    title: "El mismo circuito, un nuevo comportamiento",
    body: [
      "Un parpadeo es una pequeña coreografía: cambiar de estado, esperar y repetir. El circuito no sabe de segundos; el programa decide cuándo cambiar.",
      "Una variable guarda el intervalo. Un bucle repite las instrucciones. Si cada pausa dura medio segundo, una pausa encendido más otra apagado forman un ciclo completo de un segundo.",
    ],
    facts: [
      { label: "Pausa inicial", value: "0,5 s" },
      { label: "Ciclo completo", value: "1 s" },
      { label: "Salida", value: "GP2 / D2" },
    ],
  },
  arduino: {
    rows: [
      { from: "D2", to: "220 Ω → ánodo LED", color: "verde" },
      { from: "Cátodo LED", to: "GND", color: "negro" },
    ],
    notes: [
      "Conserva el montaje del LED. El intervalo del sketch está en milisegundos: 500 ms son 0,5 s.",
    ],
  },
  why: "No necesitas un segundo circuito para cambiar el ritmo. GP2 alterna entre 0 V y 3,3 V y la misma resistencia protege cada encendido. La diferencia entre luz fija y parpadeo vive en el programa.",
  expected:
    "El LED externo alterna encendido y apagado y la terminal muestra LED: 1 y LED: 0. En MicroPython, Detener interrumpe el bucle y finally apaga la salida. En el sketch, Detener carga un programa de reposo; también puedes cargar otro programa.",
  codeNotes: [
    {
      line: "intervalo = 0.5",
      note: "Es la duración de cada estado, en segundos. El ciclo completo dura el doble.",
    },
    {
      line: "led.toggle()",
      note: "Invierte el estado: si estaba apagado, enciende; si estaba encendido, apaga.",
    },
    {
      line: "finally:",
      note: "Garantiza que la luz se apague cuando el programa termina o recibe la interrupción.",
    },
  ],
  modify: [
    {
      title: "Hazlo respirar despacio",
      instruction:
        "Cambia intervalo a 1. En el sketch cambia 500 a 1000. Predice el ciclo antes de ejecutar.",
      find: "intervalo = 0.5",
      replace: "intervalo = 1",
      observe: "El ciclo completo dura dos segundos.",
      arduino: {
        instruction: "Cambia intervalo de 500 a 1000 milisegundos.",
        find: "intervalo = 500",
        replace: "intervalo = 1000",
      },
    },
    {
      title: "Acelera",
      instruction:
        "Prueba 0.1 segundos; en el sketch, 100 milisegundos. Luego vuelve al valor original.",
      find: "intervalo = 0.5",
      replace: "intervalo = 0.1",
      observe:
        "Hay cinco ciclos por segundo: el LED cambia diez veces por segundo.",
      arduino: {
        instruction: "Cambia intervalo de 500 a 100 milisegundos.",
        find: "intervalo = 500",
        replace: "intervalo = 100",
      },
    },
  ],
  experiment: [
    "Cuenta cinco ciclos completos usando un cronómetro. ¿Tu predicción coincide aproximadamente con lo observado?",
    "Deja encendido más tiempo que apagado cambiando el programa a on, pausa, off y otra pausa. ¿Cómo cambia la sensación del ritmo?",
  ],
  challenge: {
    prompt:
      "Crea una señal con tres destellos cortos, una pausa larga y repetición.",
    hints: [
      "Un bucle pequeño puede repetir tres encendidos dentro de otro bucle.",
      "Usa on y off con una pausa corta entre ambos; después del tercer destello espera un segundo.",
    ],
    solution: `from machine import Pin
from time import sleep
led = Pin(2, Pin.OUT)
try:
    while True:
        for _ in range(3):
            led.on(); sleep(0.15)
            led.off(); sleep(0.15)
        sleep(1)
finally:
    led.off()
`,
    arduino: {
      hints: [
        "loop ya se repite; dentro usa un for de tres destellos.",
        "Después del tercer destello espera 1000 milisegundos antes de repetir.",
      ],
      solution: `void setup() { pinMode(2, OUTPUT); }
void loop() {
  for (byte i = 0; i < 3; i++) {
    digitalWrite(2, HIGH); delay(150);
    digitalWrite(2, LOW); delay(150);
  }
  delay(1000);
}
`,
    },
  },
  checkpoint: [
    quiz(
      "Cada estado dura 0,5 s. ¿Cuánto dura encender y apagar?",
      "1 s",
      ["0,5 s", "2 s", "5 s"],
      "Un ciclo incluye dos pausas: una encendido y otra apagado. Por eso suman un segundo.",
    ),
    quiz(
      "¿Qué cambias para pasar de luz fija a parpadeo?",
      "La secuencia de instrucciones del programa",
      [
        "La polaridad del LED",
        "La conexión de GND a VBUS",
        "El color del cable USB",
      ],
      "La salida sigue siendo la misma. El programa la alterna a intervalos; no se necesita cambiar el circuito.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El LED queda fijo",
      checks: [
        "Comprueba que ejecutaste el ejemplo de parpadeo y no el de encendido.",
        "Si pusiste un intervalo muy pequeño, la vista puede unir destellos: vuelve a 0.5 segundos.",
      ],
    },
    serialTrouble,
  ],
});

export const button = activity("button", {
  stage: 2,
  summary:
    "Lee una acción de tu mano y descubre por qué pulsar puede valer cero.",
  icon: "tap",
  circuit: "button",
  concept: {
    title: "Una pregunta de sí o no",
    body: [
      "Un pulsador cierra un contacto solo mientras lo aprietas. La placa pregunta si ese contacto está abierto o cerrado y recibe un 1 o un 0.",
      "El pull-up interno mantiene la entrada en 1 cuando no pulsas. Al cerrar el contacto hacia GND, la lectura baja a 0. Los contactos pueden rebotar unos milisegundos: el ejemplo espera 20 ms y comprueba de nuevo.",
    ],
    facts: [
      { label: "Entrada", value: "GP4 / D4" },
      { label: "Libre", value: "1" },
      { label: "Pulsado", value: "0" },
    ],
  },
  arduino: {
    rows: [
      { from: "D4", to: "Contacto del pulsador", color: "amarillo" },
      { from: "Contacto que cierra al pulsar", to: "GND", color: "negro" },
    ],
    notes: [
      "INPUT_PULLUP evita una resistencia externa. Retira DHT11 de D4 si estaba conectado: son actividades individuales diferentes.",
    ],
  },
  why: "Un contacto va a la entrada y el otro a GND. El pull-up hace que la entrada tenga un estado definido sin pulsar. Nunca conectes el botón directamente entre positivo y GND: eso produciría un cortocircuito al apretarlo.",
  codeNotes: [
    {
      line: "Pin.PULL_UP",
      note: "Activa una resistencia interna que mantiene la entrada en alto cuando el botón está libre.",
    },
    {
      line: "sleep_ms(20)",
      note: "Espera a que el contacto mecánico deje de rebotar antes de confirmar el cambio.",
    },
  ],
  modify: [
    {
      title: "Mide el rebote",
      instruction:
        "Cambia la pausa de 20 a 1 ms. Pulsa varias veces y observa si aparecen cambios adicionales. En el sketch, cambia delay(50) a delay(1).",
      find: "sleep_ms(20)",
      replace: "sleep_ms(1)",
      observe:
        "Puede aparecer ruido mecánico. Un pulso físico no garantiza un único cambio eléctrico.",
      arduino: {
        instruction:
          "Cambia delay(50) a delay(1) y observa pulsaciones sin asumir un único evento por cada una.",
        find: "delay(50)",
        replace: "delay(1)",
      },
    },
  ],
  experiment: [
    "Mantén pulsado dos segundos. ¿El ejemplo imprime cada instante o solo cuando cambia el estado?",
    "Con USB desconectado, compara las patas del pulsador y vuelve al montaje. ¿Cuáles ya están unidas sin apretar?",
  ],
  challenge: {
    prompt:
      "Predice qué valor leerías al unir directamente la entrada a GND y explica por qué no necesitas hacerlo para comprobarlo.",
    hints: [
      "Pulsar ya une esa entrada a GND.",
      "El ejemplo imprime Pulsado cuando current vale cero.",
    ],
    arduino: {
      hints: [
        "Pulsar ya conecta la entrada a GND.",
        "digitalRead(4) vale LOW al cerrar hacia GND. INPUT_PULLUP mantiene HIGH cuando el contacto está abierto.",
      ],
    },
  },
  checkpoint: [
    quiz(
      "Con pull-up, ¿qué valor corresponde a pulsar?",
      "0, porque la entrada se une a GND",
      ["1, siempre", "3,3", "Un porcentaje entre 0 y 100"],
      "El pull-up mantiene 1 en reposo. El contacto hacia GND vence ese pull-up y la lectura pasa a 0.",
    ),
    quiz(
      "¿Por qué esperar unos milisegundos antes de confirmar?",
      "Para reducir cambios causados por rebote mecánico",
      ["Para calentar el LED", "Para conectar Wi-Fi", "Para cargar la batería"],
      "Los contactos no cierran de manera perfecta en un solo instante. Una espera breve permite comprobar un estado estable.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Siempre aparece Pulsado",
      checks: [
        "Retira USB y revisa que elegiste contactos que solo se unen al pulsar, no dos patas del mismo lado.",
        "Comprueba que el cable de GP4 no quedó unido a GND en una misma tira.",
      ],
    },
    {
      symptom: "Nunca cambia al pulsar",
      checks: [
        "Verifica el cable de señal en a6, que corresponde a GP4.",
        "Comprueba que el segundo contacto llega al riel GND y que ese riel está alimentado como GND.",
      ],
    },
  ],
});

export const buttonLed: Lesson = {
  ...button,
  id: "button_led",
  title: "Tu mano toma el control",
  summary:
    "Une una entrada y una salida: el pulsador decide cuándo encender el LED.",
  duration: 5,
  circuit: "buttonLed",
  sensor: undefined,
  objective:
    "Controlar el LED externo según una entrada digital, con un circuito seguro y un programa que reacciona.",
  materials: [
    ...button.materials,
    { name: "LED y resistencia de 220 Ω", qty: 1 },
  ],
  concept: {
    title: "Leer, decidir, actuar",
    body: [
      "Antes escribiste una orden fija para el LED. Ahora el programa lee algo del mundo real y decide una salida: tu mano pasa a ser parte del programa.",
      "La relación es sencilla: si el botón está en cero, encender; si está en uno, apagar. Esa misma estructura aparece después en una alerta de suelo seco, aunque la entrada sea una medición.",
    ],
    facts: [
      { label: "Lee", value: "GP4 / D4" },
      { label: "Actúa", value: "GP2 / D2" },
      { label: "Regla", value: "Pulsado → encendido" },
    ],
  },
  arduino: {
    rows: [
      ...button.arduino!.rows,
      { from: "D2", to: "220 Ω → ánodo LED", color: "verde" },
      { from: "Cátodo LED", to: "GND", color: "negro" },
    ],
    notes: button.arduino!.notes,
  },
  why: "La entrada solo lee el contacto; la salida entrega corriente limitada por su resistencia al LED. Comparten GND, pero cada señal tiene su propio pin. Mezclar señal y alimentación impediría leer o podría dañar la placa.",
  code: `from machine import Pin
from time import sleep_ms
button = Pin(4, Pin.IN, Pin.PULL_UP)
led = Pin(2, Pin.OUT, value=0)
try:
    while True:
        pressed = button.value() == 0
        sleep_ms(20)
        if pressed == (button.value() == 0):
            led.value(pressed)
        sleep_ms(5)
finally:
    led.off()
`,
  arduinoCode: `void setup() {
  pinMode(4, INPUT_PULLUP);
  pinMode(2, OUTPUT);
}
void loop() {
  bool pressed = digitalRead(4) == LOW;
  delay(20);
  if (pressed == (digitalRead(4) == LOW)) digitalWrite(2, pressed ? HIGH : LOW);
  delay(5);
}
`,
  codeNotes: [
    {
      line: "button.value() == 0",
      note: "Compara una lectura con cero y obtiene una respuesta verdadero o falso.",
    },
    {
      line: "led.value(pressed)",
      note: "Verdadero vale 1 y enciende; falso vale 0 y apaga.",
    },
  ],
  expected:
    "El LED enciende mientras aprietas el botón y se apaga al soltarlo. Este ejemplo no imprime lecturas: la evidencia es la luz real.",
  sampleOutput: undefined,
  modify: [
    {
      title: "Invierte la regla",
      instruction:
        "Escribe not pressed en la orden del LED. En el sketch invierte HIGH y LOW del operador de decisión.",
      find: "led.value(pressed)",
      replace: "led.value(not pressed)",
      observe: "El LED queda encendido en reposo y se apaga al pulsar.",
      arduino: {
        instruction: "Invierte los niveles usados según pressed.",
        find: "pressed ? HIGH : LOW",
        replace: "pressed ? LOW : HIGH",
      },
    },
  ],
  experiment: [
    "Antes de ejecutar la regla invertida, señala en qué estado esperas ver la luz.",
    "Mantén pulsado y suelta muy despacio. ¿El rebote modifica el resultado estable?",
  ],
  challenge: {
    prompt:
      "Describe una regla para avisar con el LED cuando un sensor de suelo mida por debajo de un límite.",
    hints: [
      "Sustituye pulsado por una comparación entre medición y umbral.",
      "La estructura sigue siendo leer → comparar → encender o apagar.",
    ],
    arduino: {
      hints: [
        "La condición puede comparar una lectura calibrada con un umbral.",
        "En lugar de digitalRead del botón, usa una medición válida. No compares directamente raw con un porcentaje sin calibrar.",
      ],
    },
  },
  checkpoint: [
    quiz(
      "¿Qué parte lee y qué parte actúa?",
      "GP4 lee el botón y GP2 controla el LED",
      [
        "GP2 lee el botón y GND decide",
        "Ambos pines alimentan el botón",
        "El USB toma la decisión sin código",
      ],
      "La función de cada pin está definida en el programa: una entrada lee y una salida controla la luz.",
    ),
    quiz(
      "¿Qué hace not pressed en la orden del LED?",
      "Invierte la condición de encendido",
      [
        "Elimina la resistencia",
        "Aumenta el voltaje",
        "Conecta el botón a Internet",
      ],
      "not convierte verdadero en falso y falso en verdadero. Cambia la regla sin tocar el montaje físico.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El botón responde pero el LED no",
      checks: [
        "Revisa primero el montaje de LED solo: polaridad, resistencia y GP2.",
        "Luego comprueba el montaje del botón. Probar cada parte por separado reduce causas posibles.",
      ],
    },
    ...button.troubleshooting,
  ],
};
