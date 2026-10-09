import { activity, quiz, serialTrouble } from "../library";

export const stepper = activity("stepper", {
  stage: "explora",
  icon: "sparkle",
  summary:
    "Ordena una secuencia de bobinas con el ULN2003 y distingue control de potencia.",
  concept: {
    title: "El orden hace girar, la fuente aporta energía",
    body: [
      "Un motor paso a paso tiene bobinas que atraen su rotor. Activarlas en secuencia mueve el eje en pasos. Cambiar el orden cambia la dirección.",
      "El GPIO no alimenta las bobinas. El ULN2003 conduce su corriente y aporta diodos de protección. Este ejemplo activa solo una bobina cada vez y libera todas al terminar, reduciendo consumo y evitando sostener el motor energizado.",
      "Antes de usar el USB, el docente debe comprobar el motor real y la corriente de una bobina. El ángulo por paso y la caja reductora varían: 128 pasos no se anuncian como una vuelta universal.",
    ],
    facts: [
      { label: "Secuencia", value: "1000 → 0100 → 0010 → 0001" },
      { label: "Driver", value: "ULN2003" },
      { label: "Energía", value: "5 V, validada" },
    ],
  },
  pins: {
    part: "Motor unipolar de 5 V y ULN2003 del kit",
    rows: [
      { from: "GND del módulo o chip pin 8", to: "GND", color: "negro" },
      {
        from: "Positivo común del motor y COM del chip pin 9",
        to: "VBUS, 5 V",
        color: "naranja",
        warning:
          "Solo después de verificar corriente de una bobina y presupuesto USB.",
      },
      { from: "IN1 / IN2 / IN3 / IN4", to: "GP20 / GP21 / GP22 / GP0" },
      {
        from: "Bobinas o conector del motor",
        to: "OUT1 / OUT2 / OUT3 / OUT4 del módulo",
        note: "Chip desnudo: salidas 16, 15, 14 y 13, según ficha.",
      },
    ],
    notes: [
      "Actividad individual con los demás sensores y Wi-Fi desconectados. No se conecta el motor directamente a GPIO.",
    ],
  },
  arduino: {
    rows: [
      { from: "GND de ULN2003", to: "GND" },
      {
        from: "Común motor y COM driver",
        to: "5V",
        warning: "Requiere presupuesto USB comprobado por el docente.",
      },
      { from: "IN1 / IN2 / IN3 / IN4", to: "D4 / D5 / D6 / D7" },
      { from: "Motor", to: "Conector/salidas de ULN2003" },
    ],
    notes: [
      "Retira sensores que usen D4–D7. La secuencia mantiene una sola bobina activa.",
    ],
  },
  safety: [
    "Desconecta USB antes de montar y no uses el soporte de 9 V directamente en el motor de 5 V.",
    "Si no está comprobado el presupuesto eléctrico de la unidad, estudia la secuencia sin conectar potencia al motor.",
    "No aumentes torque activando varias bobinas sin revisar antes el consumo. Deja libre el eje y evita cargas mecánicas.",
  ],
  why: "El driver separa la señal GPIO de la corriente de la bobina. GND compartido permite interpretar IN1–IN4 y los diodos del ULN2003 limitan transitorios inductivos. Una bobina a la vez reduce consumo, pero también torque respecto de otras secuencias.",
  codeNotes: [
    {
      line: "pins = [Pin(p, Pin.OUT, value=0) for p in (20, 21, 22, 0)]",
      note: "Prepara cuatro señales apagadas para las entradas del driver.",
    },
    {
      line: "pins[(step * direction) % 4].on()",
      note: "Elige una sola bobina; el signo de direction invierte el recorrido.",
    },
    {
      line: "finally:",
      note: "Apaga las bobinas aunque el programa sea interrumpido.",
    },
  ],
  modify: [
    {
      title: "Menos pasos, mismo cuidado",
      instruction:
        "Cambia range(128) por range(64). No modifiques la cantidad de bobinas activas.",
      find: "range(128)",
      replace: "range(64)",
      observe:
        "El recorrido se reduce aproximadamente a la mitad, conservando ida y regreso.",
      arduino: {
        instruction: "Cambia step<128 por step<64.",
        find: "step<128",
        replace: "step<64",
      },
    },
  ],
  experiment: [
    "Predice la bobina siguiente en ambas direcciones antes de ejecutar.",
    "Si el motor está validado, observa que pierde torque de retención al terminar. ¿Por qué eso ayuda a no dejar consumo permanente?",
  ],
  challenge: {
    prompt:
      "Explica por qué un programa de secuencia correcto no basta para declarar seguro el motor.",
    hints: [
      "También importan tensión, corriente, driver y carga mecánica.",
      "Se debe comprobar corriente de bobina y presupuesto de la fuente real; el código no aumenta la capacidad del USB.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Quién conduce corriente de las bobinas?",
      "El ULN2003, no el GPIO",
      [
        "El editor de texto",
        "El pin GP20 directamente",
        "El sensor de humedad",
      ],
      "El GPIO solo manda una orden a la entrada. La bobina necesita el camino de potencia del driver y una fuente apropiada.",
    ),
    quiz(
      "¿128 pasos equivalen siempre a una vuelta?",
      "No, depende del motor y de su reductora",
      [
        "Sí, en todos los modelos",
        "Solo si el cable es rojo",
        "Siempre equivalen a dos vueltas",
      ],
      "La relación entre pasos eléctricos y giro del eje depende de la geometría y la caja reductora del motor real.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Vibra pero no gira",
      checks: [
        "Apaga y revisa orden de bobinas y conexión al ULN2003, sin probar conectores al azar con alimentación.",
        "Comprueba corriente, tensión y carga mecánica con el docente; no actives más bobinas para compensar.",
      ],
    },
    {
      symptom: "La placa se reinicia al activar el motor",
      checks: [
        "Desconecta potencia del motor inmediatamente.",
        "Revisa el presupuesto de la fuente y conexiones. La actividad no se valida con una alimentación insuficiente.",
      ],
    },
  ],
});

export const servo = activity("servo", {
  stage: "explora",
  icon: "wave",
  summary:
    "Explora la orden de posición del SG90 con un LED y aprende qué energía falta para moverlo.",
  concept: {
    title: "Una orden no es la energía de un motor",
    body: [
      "El servo interpreta la duración de un pulso repetido. A unos 50 Hz, pulsos próximos a 1,5 ms representan posiciones cercanas al centro, según el modelo.",
      "La señal solo comunica una orden. Para mover el eje hace falta una fuente regulada que cubra los picos de corriente del servo. Esa fuente no está en el inventario: con el kit actual comprobamos pulsos en un LED protegido y dejamos VCC del SG90 desconectado.",
      "Ni 3,3 V de la placa ni la batería de 9 V sustituyen una fuente de 4,8–6 V validada. La actividad enseña una limitación real de ingeniería en vez de prometer un movimiento sin energía suficiente.",
    ],
    facts: [
      { label: "Periodo", value: "20 ms" },
      { label: "Pulsos de prueba", value: "1,3 / 1,5 / 1,7 ms" },
      { label: "Kit actual", value: "Señal con LED" },
    ],
  },
  pins: {
    part: "Prueba de señal; servo sin potencia",
    rows: [
      { from: "GP20, pin 26", to: "1 kΩ → ánodo LED", color: "verde" },
      { from: "Cátodo LED", to: "GND", color: "negro" },
      {
        from: "VCC del SG90",
        to: "Sin conectar",
        warning: "No se presupone una fuente regulada externa en este kit.",
      },
    ],
    notes: [
      "El LED muestra pulsos tenues, no un ángulo. Movimiento del servo solo como ampliación posterior con fuente regulada y corriente comprobadas por el docente.",
    ],
  },
  arduino: {
    rows: [
      { from: "D10", to: "1 kΩ → ánodo LED", color: "verde" },
      { from: "Cátodo LED", to: "GND", color: "negro" },
      { from: "VCC del SG90", to: "Sin conectar" },
    ],
    notes: [
      "El sketch genera pulsos directamente y los detiene al terminar. No garantiza potencia para mover un SG90 desde USB.",
    ],
  },
  safety: [
    "Desconecta USB antes de montar. La prueba central usa solo LED con 1 kΩ; VCC del servo queda desconectado.",
    "No alimentes el SG90 a 9 V ni desde un GPIO. ULN2003 no sustituye la alimentación ni el controlador interno del servo.",
    "No prometas posición exacta: ancho y recorrido dependen del modelo y una señal no verifica potencia disponible.",
  ],
  why: "La duración del nivel alto transporta información y la conexión de alimentación transportaría potencia. Son responsabilidades distintas. Un LED protegido permite explorar la señal con el material existente sin asumir una fuente adicional.",
  codeNotes: [
    {
      line: "signal.freq(50)",
      note: "Cincuenta periodos por segundo producen un periodo de veinte mil microsegundos.",
    },
    {
      line: "int(micros * 65535 / 20000)",
      note: "Convierte el ancho alto a la proporción del periodo para el PWM.",
    },
    {
      line: "signal.deinit()",
      note: "Libera el generador de señal al terminar la prueba.",
    },
  ],
  modify: [
    {
      title: "Cambia una orden cercana al centro",
      instruction:
        "Cambia la secuencia a (1400, 1500, 1600, 1500). Mantén el periodo de 20 ms y el servo sin potencia.",
      find: "(1300, 1500, 1700, 1500)",
      replace: "(1400, 1500, 1600, 1500)",
      observe:
        "La terminal informa nuevos anchos reales de pulso. El LED sigue tenue; no se afirma movimiento del servo.",
      arduino: {
        instruction:
          "Cambia widths de {1300,1500,1700,1500} a {1400,1500,1600,1500}.",
        find: "widths[]={1300,1500,1700,1500}",
        replace: "widths[]={1400,1500,1600,1500}",
      },
    },
  ],
  experiment: [
    "Calcula qué proporción del periodo ocupa un pulso de 1,5 ms sobre 20 ms. ¿Por qué el LED se ve tenue?",
    "Señala qué parte de un futuro circuito comunica la posición y qué parte aportaría energía para mover el eje.",
  ],
  challenge: {
    prompt:
      "Explica a un compañero por qué esta prueba produce una señal funcional pero no valida movimiento del SG90.",
    hints: [
      "Compara la energía de un LED con el pico de corriente de un motor.",
      "La fuente regulada apta no está en el inventario. Medir o generar el pulso no resuelve esa falta de potencia.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué describe la orden de posición de un servo?",
      "El ancho de un pulso dentro de un periodo repetido",
      [
        "El color del jumper",
        "Un voltaje analógico fijo universal",
        "La contraseña del Wi-Fi",
      ],
      "El servo interpreta duración de pulso. El periodo y la alimentación son parámetros distintos de la orden.",
    ),
    quiz(
      "¿Qué resultado valida la prueba con el kit actual?",
      "Generación de pulsos y su señal en el LED protegido",
      [
        "Movimiento garantizado del SG90",
        "Una fuente de potencia inexistente",
        "Un ángulo exacto de 90 grados",
      ],
      "La actividad usa el inventario disponible sin afirmar una energía que no está verificada. El servo queda sin alimentación.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El LED se ve muy tenue",
      checks: [
        "Es esperable por la pequeña fracción del periodo que queda alta.",
        "Comprueba LED, 1 kΩ y GND con USB desconectado. No retires la protección para compensar brillo.",
      ],
    },
    serialTrouble,
  ],
});
