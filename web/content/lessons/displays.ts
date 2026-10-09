import { activity, quiz, serialTrouble } from "../library";
import type { PinRow } from "../types";

const segmentRows = (arduino = false): PinRow[] =>
  ["A", "B", "C", "D", "E", "F", "G"].map((segment, index) => ({
    from: `Segmento ${segment} del display, según ficha`,
    to: arduino ? `D${index + 5}` : `GP${index + 5}`,
  }));

const displaySafety = [
  "Desconecta USB para cablear y confirma modelo, polaridad y pinout con el docente. La posición de COM y segmentos no es universal.",
  "Este escaneo enciende un solo LED en cada instante. No lo conviertas en encendido simultáneo de varios segmentos con una resistencia compartida.",
];

export const sevenSegment = activity("seven_segment", {
  stage: "explora",
  icon: "lightbulb",
  summary:
    "Construye una cifra con siete segmentos, escaneando un solo LED a la vez.",
  concept: {
    title: "Un número es un dibujo de siete luces",
    body: [
      "Cada cifra se dibuja activando una combinación de segmentos A–G. Una máscara de bits guarda cuáles pertenecen al dibujo: un uno pide incluir un segmento.",
      "El ejemplo recorre un segmento cada vez para mantener la corriente limitada con el inventario del kit. Tu vista une ese recorrido rápido en un número. COM y la polaridad dependen del modelo: hay que identificarlos antes de cablear.",
    ],
    facts: [
      { label: "Segmentos", value: "A–G" },
      { label: "COM protegido", value: "1 kΩ hacia GP12" },
      { label: "Número inicial", value: "2" },
    ],
  },
  pins: {
    part: "Display de siete segmentos identificado",
    rows: [
      ...segmentRows(),
      {
        from: "COM o ambos COM unidos antes de la resistencia",
        to: "1 kΩ → GP12, pin 16",
      },
    ],
    notes: [
      "DP queda sin conectar. COMMON_ANODE debe coincidir con la ficha: False para cátodo común, True para ánodo común.",
    ],
  },
  arduino: {
    rows: [
      ...segmentRows(true),
      { from: "COM o ambos COM unidos", to: "1 kΩ → A0" },
    ],
    notes: [
      "A0 se usa como salida digital en este ejemplo individual. COMMON_ANODE debe coincidir con el display real.",
    ],
  },
  safety: displaySafety,
  why: "Solo un segmento conduce a la vez y su camino pasa por la resistencia de COM. El software apaga todo antes del próximo segmento. La máscara representa el dibujo; la polaridad determina qué niveles eléctricos lo encienden.",
  codeNotes: [
    {
      line: "values = [2]",
      note: "Elige qué cifra buscar en la tabla de máscaras, entre cero y nueve.",
    },
    {
      line: "blank()",
      note: "Apaga todos los caminos antes de seleccionar un nuevo segmento.",
    },
  ],
  modify: [
    {
      title: "Dibuja tu número",
      instruction:
        "Cambia values = [2] por values = [7]. Conserva escaneo y blank.",
      find: "values = [2]",
      replace: "values = [7]",
      observe: "La figura cambia a siete sin cambiar conexiones.",
      arduino: {
        instruction: "Cambia el arreglo values de {2} a {7}.",
        find: "const byte values[] = {2};",
        replace: "const byte values[] = {7};",
      },
    },
  ],
  experiment: [
    "Dibuja el 2 en papel y nombra sus segmentos. Compara con la máscara de la tabla.",
    "Prueba el 1 y el 8. ¿La percepción de brillo es igual al repartir el escaneo entre más segmentos?",
  ],
  challenge: {
    prompt:
      "Explica por qué no debes quitar blank ni encender siete segmentos juntos con este montaje.",
    hints: [
      "La resistencia de COM limita un camino compartido.",
      "El presupuesto de corriente supone un solo LED activo en cada instante, no varias corrientes simultáneas.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué representa un bit de la máscara?",
      "Si un segmento pertenece a la cifra",
      ["Un grado Celsius", "Una conexión Wi-Fi", "Un voltio de alimentación"],
      "La máscara es un dibujo codificado. Cada posición representa un segmento, y el programa lo recorre si el bit vale uno.",
    ),
    quiz(
      "¿Por qué se consulta el modelo del display?",
      "Porque polaridad y posición física de las patas pueden variar",
      [
        "Para decidir el nombre del grupo",
        "Porque los números cambian de significado",
        "Para eliminar las resistencias",
      ],
      "No existe un pinout universal para todas las piezas. Antes de conectar se identifican A–G y los comunes del componente real.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "La cifra es incorrecta o no aparece",
      checks: [
        "Comprueba pinout y COMMON_ANODE antes de repetir la ejecución.",
        "Revisa segmentos A–G y COM mediante su resistencia; comienza verificando una sola luz con el docente.",
      ],
    },
    serialTrouble,
  ],
});

export const fourDigit = activity("four_digit", {
  stage: "explora",
  icon: "chart",
  summary:
    "Comparte siete señales entre cuatro posiciones y descubre el refresco de una pantalla.",
  concept: {
    title: "Cuatro dígitos comparten sus segmentos",
    body: [
      "Los segmentos A–G se comparten entre cuatro posiciones. Para iluminar uno, seleccionas tanto un segmento como el común del dígito correspondiente.",
      "La multiplexación recorre parejas de dígito y segmento rápidamente. Aquí solo una luz conduce cada vez y cada común tiene su propia resistencia de 1 kΩ. El resultado puede verse tenue: es una demostración segura con el kit, no un cartel de alta potencia.",
    ],
    facts: [
      { label: "Comunes", value: "D1–D4" },
      { label: "Limitadores", value: "4 × 1 kΩ" },
      { label: "Mensaje inicial", value: "2026" },
    ],
  },
  pins: {
    part: "Display de cuatro dígitos",
    rows: [
      ...segmentRows(),
      ...[12, 13, 14, 15].map((pin, i) => ({
        from: `Común D${i + 1} mediante su resistencia de 1 kΩ`,
        to: `GP${pin}`,
      })),
    ],
    notes: [
      "DP queda desconectado. Identifica todos los comunes con la ficha del módulo. Esta actividad ocupa pines usados por sensores; retira el montaje de estación.",
    ],
  },
  arduino: {
    rows: [
      ...segmentRows(true),
      ...[0, 1, 2, 3].map((pin, i) => ({
        from: `Común D${i + 1} mediante su resistencia de 1 kΩ`,
        to: `A${pin}`,
      })),
    ],
    notes: [
      "A0–A3 se usan como salidas digitales. Verifica COMMON_ANODE y el pinout del componente real.",
    ],
  },
  safety: displaySafety,
  why: "El común selecciona una posición y los segmentos seleccionan parte del dibujo. Cuatro resistencias mantienen separados los caminos de los comunes. blank evita que el cambio deje encendida una pareja del paso anterior.",
  codeNotes: [
    {
      line: "values = [2, 0, 2, 6]",
      note: "Cada elemento representa la cifra de una posición.",
    },
    {
      line: "sleep_us(700)",
      note: "Define la breve permanencia de una pareja segmento/dígito.",
    },
  ],
  modify: [
    {
      title: "Tu grupo en cuatro posiciones",
      instruction:
        "Cambia values por [0, 0, 0, 7] o las cifras de tu grupo. Usa solo enteros de cero a nueve.",
      find: "values = [2, 0, 2, 6]",
      replace: "values = [0, 0, 0, 7]",
      observe:
        "La pantalla representa 0007; cada dígito se obtiene del elemento correspondiente.",
      arduino: {
        instruction: "Cambia values de {2,0,2,6} a {0,0,0,7}.",
        find: "const byte values[] = {2,0,2,6};",
        replace: "const byte values[] = {0,0,0,7};",
      },
    },
  ],
  experiment: [
    "Predice qué pasa si todas las posiciones tienen la misma cifra. Luego ejecútalo.",
    "Cuenta las líneas de control: siete segmentos y cuatro comunes. ¿Por qué no hacen falta veintiocho GPIO?",
  ],
  challenge: {
    prompt:
      "Explica la diferencia entre compartir las líneas de segmento y unir todos los comunes a un solo GPIO.",
    hints: [
      "Las líneas compartidas describen el dibujo, pero el común elige dónde aparece.",
      "Unir comunes impediría elegir un dígito independiente y cambiaría el presupuesto de corriente.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Cómo se elige una posición del display?",
      "Activando su común y un segmento durante el escaneo",
      [
        "Cambiando la alimentación del computador",
        "Usando una resistencia entre dos GPIO al azar",
        "Escribiendo el número en el Wi-Fi",
      ],
      "El programa selecciona una pareja de común y segmento. La repetición rápida reúne las parejas en cuatro cifras visibles.",
    ),
    quiz(
      "¿Cuántas resistencias de común usa este montaje?",
      "Cuatro, una por dígito",
      ["Ninguna", "Una compartida sin escaneo", "Dieciséis"],
      "Cada común lleva su limitador de 1 kΩ. La protección sigue dependiendo de activar un solo LED en cada instante.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Aparecen cifras en posiciones equivocadas",
      checks: [
        "Verifica D1–D4 en la ficha y que cada común llega al pin previsto mediante su resistencia.",
        "Comprueba el orden de values y que no cambiaste el escaneo que apaga todo primero.",
      ],
    },
    {
      symptom: "Se ve tenue o parpadea",
      checks: [
        "Comienza con un solo segmento y confirma polaridad y pinout.",
        "Conserva el código de escaneo seguro. No aumentes brillo quitando resistencias ni activando más luces a la vez.",
      ],
    },
  ],
});

export const matrix = activity("matrix", {
  stage: "explora",
  icon: "sprout",
  summary:
    "Dibuja una hoja con bits y una matriz desnuda, usando únicamente resistencias del kit.",
  concept: {
    title: "Sesenta y cuatro píxeles en dieciséis líneas",
    body: [
      "La matriz comparte ocho filas y ocho columnas. Una intersección identifica una luz. El dibujo se guarda como ocho bytes: cada byte describe los ocho píxeles de una fila.",
      "El código escanea un solo píxel por vez y apaga antes de elegir el siguiente. El kit aporta cinco resistencias de 1 kΩ y tres de 10 kΩ: las últimas filas serán más tenues, una limitación visible del material disponible.",
    ],
    facts: [
      { label: "Tamaño", value: "8 × 8" },
      { label: "Datos del dibujo", value: "8 bytes" },
      { label: "Limitación", value: "Brillo desigual" },
    ],
  },
  pins: {
    part: "Matriz 8×8 desnuda, sin MAX7219",
    rows: [
      ...Array.from({ length: 8 }, (_, i) => ({
        from: `Fila R${i + 1} mediante ${i < 5 ? "1 kΩ" : "10 kΩ"}`,
        to: `GP${i}`,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        from: `Columna C${i + 1}`,
        to: `GP${i + 8}`,
      })),
    ],
    notes: [
      "Identifica filas, columnas y polaridad en la ficha del modelo. ROW_ANODE=True corresponde a filas ánodo. Retira la estación; estos GPIO pertenecen a este experimento individual.",
    ],
  },
  arduino: {
    rows: [
      ...Array.from({ length: 8 }, (_, i) => ({
        from: `Fila R${i + 1} mediante ${i < 5 ? "1 kΩ" : "10 kΩ"}`,
        to: `D${i + 2}`,
      })),
      ...["D10", "D11", "D12", "D13", "A0", "A1", "A2", "A3"].map((pin, i) => ({
        from: `Columna C${i + 1}`,
        to: pin,
      })),
    ],
    notes: [
      "Los pines analógicos listados funcionan como salidas digitales. El modelo desnudo no necesita una biblioteca MAX7219.",
    ],
  },
  safety: [
    "Desconecta USB antes de cablear. Confirma pinout y polaridad del modelo; no todos usan el mismo orden.",
    "Conserva una resistencia por fila y un solo píxel activo. Nunca anules blank ni enciendas una fila completa simultáneamente con este circuito.",
  ],
  why: "La fila y columna elegidas completan un único camino de corriente limitado por la resistencia de fila. El software recorre los bits del dibujo y evita caminos simultáneos. No se presupone un módulo controlador adicional que el inventario no incluye.",
  codeNotes: [
    {
      line: "bitmap = [0x18, 0x3C, 0x7E, 0xDB, 0x7E, 0x3C, 0x18, 0x18]",
      note: "Ocho bytes forman la hoja; cada bit es una posición encendida o apagada.",
    },
    {
      line: "bitmap[y] & (1 << (7-x))",
      note: "Consulta un píxel concreto de la fila que se está recorriendo.",
    },
  ],
  modify: [
    {
      title: "Dibuja un centro simple",
      instruction:
        "Reemplaza el bitmap por [0, 0, 0x18, 0x18, 0x18, 0x18, 0, 0]. Mantén el escaneo.",
      find: "bitmap = [0x18, 0x3C, 0x7E, 0xDB, 0x7E, 0x3C, 0x18, 0x18]",
      replace: "bitmap = [0, 0, 0x18, 0x18, 0x18, 0x18, 0, 0]",
      observe:
        "Aparece una figura central distinta, con las mismas conexiones.",
      arduino: {
        instruction: "Cambia bitmap por {0,0,0x18,0x18,0x18,0x18,0,0}.",
        find: "const byte bitmap[]={0x18,0x3C,0x7E,0xDB,0x7E,0x3C,0x18,0x18};",
        replace: "const byte bitmap[]={0,0,0x18,0x18,0x18,0x18,0,0};",
      },
    },
  ],
  experiment: [
    "Dibuja tu figura en una grilla de ocho por ocho. Marca unos donde quieres luz y ceros donde quieres oscuridad.",
    "Compara el brillo de una fila con 1 kΩ y otra con 10 kΩ. Explica la diferencia sin quitar protección.",
  ],
  challenge: {
    prompt:
      "Diseña una semilla, flecha o letra de ocho por ocho editando solo bitmap.",
    hints: [
      "Convierte cada fila de ocho bits a un byte, sin modificar el escaneo.",
      "0x18 es 00011000: ilumina las dos columnas centrales.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué define un píxel?",
      "Una pareja de fila y columna",
      [
        "Un cable USB por píxel",
        "Una resistencia que almacena texto",
        "Una conexión Wi-Fi",
      ],
      "Las líneas se comparten. Elegir una fila y una columna forma la intersección de un LED específico.",
    ),
    quiz(
      "¿Por qué algunas filas son más tenues?",
      "Usan 10 kΩ en vez de 1 kΩ por el inventario disponible",
      [
        "Porque el código inventa esos píxeles",
        "Porque falta un MAX7219 obligatorio",
        "Porque los bytes finales no representan luz",
      ],
      "Una resistencia mayor limita más corriente. La guía reconoce el efecto en vez de pedir piezas adicionales que no existen.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "La figura está girada o desordenada",
      checks: [
        "Verifica R1–R8 y C1–C8 según el modelo real, no una imagen genérica.",
        "Comprueba ROW_ANODE y el orden de los arrays; no cambies cables con alimentación.",
      ],
    },
    {
      symptom: "La imagen es tenue",
      checks: [
        "Es esperable al activar un solo píxel a la vez y usar resistencias diferentes.",
        "Confirma primero una intersección segura. No retires resistencias para compensar el escaneo.",
      ],
    },
  ],
});

export const lcd = activity("lcd", {
  stage: "explora",
  icon: "code",
  summary:
    "Escribe un mensaje en dos líneas con el LCD paralelo del kit, sin adaptador I2C.",
  concept: {
    title: "Un mensaje también puede vivir fuera de la web",
    body: [
      "El LCD 16×2 tiene dieciséis posiciones por línea y dos líneas. El programa envía comandos y caracteres a un controlador compatible con HD44780.",
      "El bus de cuatro bits transporta cada byte en dos partes. RS distingue un dato de un comando y E indica cuándo capturarlo. RW se fija a GND para usar solo escritura y evitar señales de retorno de 5 V hacia la placa.",
    ],
    facts: [
      { label: "Tamaño", value: "16 × 2 caracteres" },
      { label: "Interfaz", value: "Paralela, 4 bits" },
      { label: "Modo", value: "Solo escritura" },
    ],
  },
  pins: {
    part: "LCD paralelo identificado",
    rows: [
      { from: "VSS 1 y RW 5", to: "GND", color: "negro" },
      { from: "VDD 2", to: "VBUS, 5 V", color: "naranja" },
      { from: "Potenciómetro: extremos", to: "VBUS, 5 V y GND" },
      {
        from: "Cursor del potenciómetro",
        to: "V0, pin 3 del LCD",
        note: "Este cursor NO va al ADC de Pico.",
      },
      { from: "RS 4 / E 6", to: "GP5 / GP6" },
      { from: "D4 11 / D5 12 / D6 13 / D7 14", to: "GP7 / GP8 / GP9 / GP10" },
      { from: "Backlight A 15", to: "220 Ω → VBUS, 5 V" },
      { from: "Backlight K 16", to: "GND" },
    ],
    notes: [
      "D0–D3 quedan desconectados. Verifica que el controlador acepta alto lógico de 3,3 V antes de usar este montaje.",
    ],
  },
  arduino: {
    rows: [
      { from: "VSS 1 y RW 5", to: "GND" },
      { from: "VDD 2 y extremo del potenciómetro", to: "5V" },
      { from: "Otro extremo del potenciómetro", to: "GND" },
      { from: "Cursor del potenciómetro", to: "V0 3" },
      { from: "RS 4 / E 6", to: "D5 / D6" },
      { from: "D4 11 / D5 12 / D6 13 / D7 14", to: "D7 / D8 / D9 / D10" },
      { from: "Backlight A 15 / K 16", to: "5V mediante 220 Ω / GND" },
    ],
    notes: [
      "Es un LCD paralelo. El sketch no exige adaptador I2C ni una biblioteca externa.",
    ],
  },
  safety: [
    "Desconecta USB antes de cablear. RW permanece en GND: el LCD no debe devolver datos de 5 V a los GPIO.",
    "El potenciómetro de contraste usa 5 V, pero su cursor llega solo a V0 del LCD, nunca a GP26.",
    "Confirma pinout, compatibilidad lógica y límites del backlight en la ficha del modelo.",
  ],
  why: "El LCD necesita su alimentación y contraste propios. Separar bus de datos, señales de control y energía permite escribir con pocos GPIO. La escritura exclusiva evita leer niveles de retorno peligrosos; la resistencia limita el backlight.",
  codeNotes: [
    {
      line: "nibble(value >> 4)",
      note: "Envía primero la mitad alta del byte; después se envía la baja.",
    },
    {
      line: "text[:16]",
      note: "Limita la línea a dieciséis caracteres visibles.",
    },
  ],
  modify: [
    {
      title: "Firma de tu grupo",
      instruction:
        "Cambia Hola, planta! por un nombre de hasta dieciséis caracteres ASCII, por ejemplo Grupo 07.",
      find: "Hola, planta!",
      replace: "Grupo 07",
      observe:
        "La segunda línea muestra tu nombre. Caracteres especiales dependen de la ROM de la pantalla.",
      arduino: {
        instruction: "Cambia el texto Hola, planta! por Grupo 07.",
        find: 'text("Hola, planta!")',
        replace: 'text("Grupo 07")',
      },
    },
  ],
  experiment: [
    "Ajusta el contraste suavemente. ¿Tener backlight encendido demuestra que el bus funciona?",
    "Prueba un texto de diecisiete caracteres y comprueba por qué la guía limita la línea a dieciséis.",
  ],
  challenge: {
    prompt:
      "Escribe dos líneas que comuniquen grupo y una observación, sin presentar un valor fijo como medición real.",
    hints: [
      "El mensaje del ejemplo es texto, no telemetría.",
      "Usa un saludo o estado que puedas verificar, como Grupo 07 y Probando LCD.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Por qué RW se conecta a GND?",
      "Para mantener modo escritura y evitar retorno de 5 V al GPIO",
      [
        "Para apagar todos los caracteres",
        "Para generar Wi-Fi",
        "Para sustituir el contraste",
      ],
      "RW bajo deshabilita las lecturas desde el LCD. Es una condición de seguridad y de simplificación del bus.",
    ),
    quiz(
      "¿Qué hace el cursor del potenciómetro en este montaje?",
      "Ajusta el contraste en V0 del LCD",
      [
        "Envía 5 V a GP26",
        "Calcula humedad del suelo",
        "Reemplaza la resistencia del backlight",
      ],
      "El potenciómetro pertenece al circuito de contraste de la pantalla. Su cursor no se conecta al ADC de la Pico.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Solo ves bloques o fondo iluminado",
      checks: [
        "Ajusta contraste; iluminación por sí sola no prueba que se reciban comandos.",
        "Desconecta USB y revisa E, RS, D4–D7 y RW a GND según el modelo.",
      ],
    },
    {
      symptom: "Aparecen caracteres incorrectos",
      checks: [
        "Confirma orden de D4–D7 y compatibilidad lógica del controlador.",
        "Empieza con ASCII simple; tildes y símbolos dependen de la ROM del LCD.",
      ],
    },
  ],
});
