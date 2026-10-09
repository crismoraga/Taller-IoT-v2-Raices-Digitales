import { activity, quiz, serialTrouble } from "../library";

export const buzzer = activity("buzzer", {
  stage: 2,
  icon: "megaphone",
  circuit: "buzzer",
  summary:
    "Escribe la altura de un sonido con PWM y distingue un piezo pasivo de un buzzer activo.",
  concept: {
    title: "Una señal puede tener ritmo audible",
    body: [
      "Un piezo pasivo vibra cuando la señal alterna. Cambiar la frecuencia cambia qué tan grave o agudo lo escuchas; no es lo mismo que cambiar cuánto dura.",
      "PWM alterna entre alto y bajo repetidamente. El ejemplo produce un tono breve y libera el pin al terminar. Solo sirve para un piezo pasivo de baja corriente apto para GPIO, no cualquier componente que tenga dos patas.",
    ],
    facts: [
      { label: "Salida", value: "GP3 / D3" },
      { label: "Tono inicial", value: "880 Hz" },
      { label: "Duración", value: "0,3 s" },
    ],
  },
  safety: [
    "Desconecta USB antes de conectar. Usa un piezo pasivo de baja corriente con 220 Ω en serie.",
    "Si es buzzer activo o transductor de consumo desconocido, sigue la actividad de driver ULN2003. Volumen bajo y lejos del oído.",
  ],
  arduino: {
    rows: [
      { from: "D3", to: "220 Ω → positivo del piezo pasivo", color: "verde" },
      { from: "Negativo del piezo", to: "GND", color: "negro" },
    ],
    notes: [
      "tone genera frecuencia y duración. Un buzzer activo tiene su propio oscilador y usa otra actividad.",
    ],
  },
  why: "La resistencia limita corriente y el PWM controla una señal, no una fuente de potencia. La limpieza finally detiene la oscilación incluso al interrumpir. Confirmar el tipo de componente evita conducir una carga grande directamente desde un pin.",
  codeNotes: [
    {
      line: "sound.freq(880)",
      note: "880 alternancias por segundo determinan la altura del tono.",
    },
    {
      line: "sound.duty_u16(12000)",
      note: "Define la proporción del periodo que queda alto; no son segundos.",
    },
    { line: "sound.deinit()", note: "Libera el PWM después de apagarlo." },
  ],
  modify: [
    {
      title: "Baja una octava",
      instruction: "Cambia 880 por 440 y conserva la duración.",
      find: "sound.freq(880)",
      replace: "sound.freq(440)",
      observe: "El tono se escucha más grave; dura lo mismo.",
      arduino: {
        instruction: "Cambia 880 por 440 en tone sin cambiar 300.",
        find: "tone(3, 880, 300)",
        replace: "tone(3, 440, 300)",
      },
    },
  ],
  experiment: [
    "Compara 440 y 880 Hz sin acercar el piezo al oído. ¿Qué cambió: altura o duración?",
    "Conserva la frecuencia y modifica la duración a medio segundo. Describe qué variable representa cada cambio.",
  ],
  challenge: {
    prompt:
      "Produce dos tonos breves distintos separados por silencio, dejando la salida apagada al final.",
    hints: [
      "Una secuencia puede cambiar freq antes de cada pausa.",
      "Entre tonos usa duty_u16(0), espera y vuelve a activar una frecuencia. Conserva finally para limpiar.",
    ],
    arduino: {
      hints: [
        "tone(pin, frecuencia, duración) produce un tono acotado.",
        "Espera a que termine, deja silencio y llama tone con la segunda frecuencia. noTone apaga la salida.",
      ],
      solution: `void setup() {
  tone(3, 440, 200); delay(200);
  noTone(3); delay(200);
  tone(3, 880, 200); delay(200);
  noTone(3);
}
void loop() {}
`,
    },
  },
  checkpoint: [
    quiz(
      "¿Qué cambia al pasar de 880 a 440 Hz?",
      "La altura del sonido: se vuelve más grave",
      [
        "La tensión máxima del GPIO",
        "La duración necesariamente se duplica",
        "El piezo se convierte en buzzer activo",
      ],
      "La frecuencia define cuántas oscilaciones hay por segundo. La pausa y duración se controlan por separado.",
    ),
    quiz(
      "¿Qué haces si el buzzer consume más corriente de la permitida?",
      "Usar el driver adecuado y revisar su alimentación",
      [
        "Conectarlo a otro GPIO directamente",
        "Quitar la resistencia para oír mejor",
        "Aumentar duty a cualquier valor",
      ],
      "Un pin es una señal con corriente limitada. Una carga mayor necesita una etapa de potencia y alimentación verificadas.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "No se escucha el tono",
      checks: [
        "Revisa que sea piezo pasivo apto para GPIO, señal en GP3 y negativo en GND.",
        "Comprueba el tipo y ficha con el docente antes de quitar protección o probar otra alimentación.",
      ],
    },
    serialTrouble,
  ],
});

export const activeBuzzer = activity("active_buzzer", {
  stage: 2,
  icon: "bell",
  summary:
    "Usa el ULN2003 del kit para activar una carga sin pedirle potencia al GPIO.",
  concept: {
    title: "Señal pequeña, carga separada",
    body: [
      "Un buzzer activo fabrica su propio tono. El programa solo decide cuándo permitir su corriente; no necesita generar la oscilación audible.",
      "El ULN2003 actúa como interruptor controlado. El GPIO llega a IN1, y OUT1 conduce el negativo de la carga hacia GND. Así separas control y corriente, una idea que se repite con motores.",
    ],
    facts: [
      { label: "Control", value: "GP3 / D3" },
      { label: "Driver", value: "ULN2003, canal 1" },
      { label: "Carga", value: "Buzzer activo verificado" },
    ],
  },
  pins: {
    part: "Buzzer activo y ULN2003",
    rows: [
      { from: "ULN2003 GND, pin 8", to: "GND", color: "negro" },
      { from: "ULN2003 COM, pin 9", to: "VBUS, 5 V", color: "naranja" },
      {
        from: "Buzzer positivo de modelo apto para 5 V",
        to: "VBUS, 5 V",
        color: "naranja",
      },
      { from: "Buzzer negativo", to: "ULN2003 OUT1, pin 16" },
      { from: "ULN2003 IN1, pin 1", to: "GP3, pin 5", color: "verde" },
    ],
    notes: [
      "El chip desnudo y el módulo no tienen la misma disposición física. Identifica IN1, OUT1, GND y COM en la ficha del módulo real.",
    ],
  },
  arduino: {
    rows: [
      { from: "ULN2003 GND", to: "GND", color: "negro" },
      { from: "ULN2003 COM y buzzer positivo", to: "5V", color: "naranja" },
      { from: "Buzzer negativo", to: "OUT1" },
      { from: "ULN2003 IN1", to: "D3", color: "verde" },
    ],
    notes: [
      "Verifica tensión y corriente del buzzer y presupuesto USB. Un buzzer de otra tensión no se conecta a 5 V por su apariencia.",
    ],
  },
  safety: [
    "Desconecta USB antes de montar y confirma la tensión nominal del buzzer.",
    "La carga no se alimenta desde el GPIO. No conectes el soporte de 9 V directamente ni acerques el buzzer al oído.",
  ],
  why: "El GPIO controla una entrada de baja corriente. El ULN2003 absorbe corriente de la carga hacia GND, mientras COM conecta los diodos de protección al positivo correspondiente. Compartir GND permite que el driver entienda la señal de control.",
  codeNotes: [
    {
      line: "driver = Pin(3, Pin.OUT, value=0)",
      note: "Arranca con el interruptor apagado, antes de emitir los pulsos.",
    },
    {
      line: "for _ in range(2):",
      note: "Produce exactamente dos avisos y no deja una alarma infinita.",
    },
  ],
  modify: [
    {
      title: "Tres avisos",
      instruction:
        "Cambia range(2) por range(3). Conserva pausas breves y salida apagada al final.",
      find: "range(2)",
      replace: "range(3)",
      observe: "El buzzer activo emite tres pulsos del mismo tono.",
      arduino: {
        instruction: "Cambia el límite i<2 por i<3.",
        find: "i<2",
        replace: "i<3",
      },
    },
  ],
  experiment: [
    "Señala el camino de corriente de la carga y el camino distinto de su control.",
    "Compara activo y pasivo sin intercambiar su cableado. ¿Quién genera la oscilación en cada caso?",
  ],
  challenge: {
    prompt:
      "Diseña una secuencia corta de aviso y una de confirmación, sin dejar la carga encendida.",
    hints: [
      "Puedes variar cuántos pulsos haces y sus pausas.",
      "La duración no cambia el tono interno del buzzer activo; conserva driver.off al terminar.",
    ],
    arduino: {
      hints: [
        "Varía la cantidad y pausa entre pulsos dentro de setup.",
        "Apaga IN1 con digitalWrite(3, LOW) al terminar. No uses tone para fingir controlar la altura del buzzer activo.",
      ],
    },
  },
  checkpoint: [
    quiz(
      "¿Qué conecta GP3 en este montaje?",
      "La entrada IN1 del driver",
      [
        "El positivo del buzzer directamente",
        "El soporte de 9 V",
        "La salida OUT1 hacia la alimentación",
      ],
      "El GPIO manda una señal al driver. La corriente del buzzer circula por su fuente, carga y transistor del ULN2003.",
    ),
    quiz(
      "¿Por qué el buzzer activo no necesita PWM audible?",
      "Porque incorpora su propio oscilador",
      [
        "Porque no necesita corriente",
        "Porque GND genera música",
        "Porque el USB guarda el tono",
      ],
      "El activo genera el tono internamente al recibir alimentación. El programa controla su encendido mediante el driver.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El buzzer no suena",
      checks: [
        "Revisa tensión nominal, positivo de carga, OUT1 e IN1 según la ficha real.",
        "Confirma GND común y que no confundiste la entrada del driver con su salida.",
      ],
    },
    {
      symptom: "Suena aun después de terminar",
      checks: [
        "Desconecta alimentación y comprueba que el negativo no quedó directo a GND evitando el driver.",
        "Revisa la salida seleccionada y conserva driver.off en la limpieza final.",
      ],
    },
  ],
});

export const tilt = activity("tilt", {
  stage: "explora",
  icon: "wave",
  circuit: "tilt",
  summary:
    "Inclina un interruptor y descubre la diferencia entre un contacto y un medidor de ángulo.",
  concept: {
    title: "Cambiar de posición abre o cierra un contacto",
    body: [
      "El SW520D es un interruptor mecánico. Al cambiar su orientación, una parte interior puede unir o separar sus contactos.",
      "La entrada con pull-up convierte ese contacto en 0 o 1. No entrega grados ni aceleración y puede rebotar al moverse. Sirve para experimentar con eventos, no para una medición continua de inclinación.",
    ],
    facts: [
      { label: "Entrada", value: "GP4 / D4" },
      { label: "Salida", value: "0/1" },
      { label: "Ángulo exacto", value: "No disponible" },
    ],
  },
  arduino: {
    rows: [
      { from: "Un contacto SW520D", to: "D4", color: "amarillo" },
      { from: "Otro contacto SW520D", to: "GND", color: "negro" },
    ],
    notes: ["Retira pulsador o DHT11 de D4 antes de esta prueba individual."],
  },
  why: "PULL_UP da un estado definido al contacto abierto. Cuando el interruptor cierra hacia GND, la lectura baja. No conectas la pieza directamente entre alimentación y GND; se utiliza como entrada de contacto.",
  codeNotes: [
    {
      line: "Pin.PULL_UP",
      note: "Mantiene el contacto abierto en alto; cerrado hacia GND vale cero.",
    },
  ],
  modify: [
    {
      title: "Lee más despacio",
      instruction:
        "Cambia sleep(0.1) por sleep(0.5) y compara los cambios visibles.",
      find: "sleep(0.1)",
      replace: "sleep(0.5)",
      observe: "Con menor cadencia puedes no ver eventos cortos.",
      arduino: {
        instruction: "Cambia delay(100) a delay(500).",
        find: "delay(100)",
        replace: "delay(500)",
      },
    },
  ],
  experiment: [
    "Inclina muy despacio y luego agita suavemente. ¿La secuencia de ceros y unos es igual?",
    "Compara dos unidades SW520D del kit. ¿Un cambio de montaje afecta cuándo cierran?",
  ],
  challenge: {
    prompt:
      "Explica por qué registrar un cero no permite afirmar que el objeto está inclinado exactamente 30 grados.",
    hints: [
      "Solo existen dos estados observables en esta conexión.",
      "La orientación que cierra depende de la pieza y cómo la montaste, no de una escala angular calibrada.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué informa un SW520D?",
      "Si su contacto está abierto o cerrado",
      ["Grados exactos", "Distancia a la maceta", "Velocidad de giro en rpm"],
      "Es un interruptor, no un inclinómetro de precisión. La conexión produce una decisión digital de dos estados.",
    ),
    quiz(
      "¿Qué hace el pull-up cuando el contacto está abierto?",
      "Mantiene la entrada en alto",
      [
        "Deja la entrada sin referencia",
        "Eleva la tensión a 9 V",
        "Mueve mecánicamente la pieza",
      ],
      "La resistencia interna define un estado en reposo. El contacto cerrado hacia GND permite leer el estado contrario.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "No cambia al inclinar",
      checks: [
        "Retira USB; revisa el contacto hacia GP4 y el otro hacia GND.",
        "Prueba varias orientaciones lentamente. El umbral mecánico no es un ángulo universal.",
      ],
    },
    serialTrouble,
  ],
});

export const flame = activity("flame", {
  stage: "explora",
  icon: "sun",
  summary:
    "Explora un detector óptico y su umbral sin encender fuego en el taller.",
  concept: {
    title: "La etiqueta llama no significa reconocimiento de fuego",
    body: [
      "El módulo responde a luz en cierta banda y compara su intensidad con un umbral. Como una alarma que escucha un sonido, puede reaccionar a fuentes distintas de la que su nombre sugiere.",
      "Usa luz ambiente o el mando infrarrojo del kit como estímulo seguro. No todos los emisores coinciden con la sensibilidad del detector. Un resultado digital no identifica una combustión ni certifica seguridad contra incendios.",
    ],
    facts: [
      { label: "Señal", value: "DO a GP12" },
      { label: "Estímulo", value: "Luz, sin fuego" },
      { label: "Resultado", value: "Comparación 0/1" },
    ],
  },
  pins: {
    part: "Módulo óptico con comparador",
    rows: [
      { from: "VCC del módulo apto para 3,3 V", to: "3V3", color: "rojo" },
      { from: "GND", to: "GND", color: "negro" },
      { from: "DO", to: "GP12, pin 16", color: "amarillo" },
    ],
    notes: [
      "Si tu pieza es un fotodiodo desnudo y no tiene comparador DO, no corresponde a este montaje. Consulta al docente.",
    ],
  },
  arduino: {
    rows: [
      { from: "VCC del módulo compatible", to: "3V3", color: "rojo" },
      { from: "GND", to: "GND", color: "negro" },
      { from: "DO", to: "D12", color: "amarillo" },
    ],
    notes: [
      "Confirma tensión y polaridad del módulo antes de interpretar el bit.",
    ],
  },
  safety: [
    "Desconecta USB antes de cablear. No uses llama, encendedor ni materiales calientes en esta actividad.",
    "Este montaje no es un sistema certificado de protección contra incendios.",
  ],
  why: "El comparador transforma intensidad óptica en un estado digital. Alimentar el módulo compatible a 3,3 V limita la señal de DO para la entrada de la Pico. Ajustar el trimmer modifica el límite, no la banda del detector.",
  codeNotes: [
    {
      line: "Pin(12, Pin.IN, Pin.PULL_UP)",
      note: "Lee DO en GP12 sin asumir todavía su polaridad.",
    },
  ],
  modify: [
    {
      title: "Busca eventos más largos",
      instruction:
        "Cambia sleep(0.1) a sleep(0.5). Conserva la fuente de luz segura.",
      find: "sleep(0.1)",
      replace: "sleep(0.5)",
      observe: "Las activaciones muy breves pueden desaparecer entre muestras.",
      arduino: {
        instruction: "Cambia delay(100) por delay(500).",
        find: "delay(100)",
        replace: "delay(500)",
      },
    },
  ],
  experiment: [
    "Ajusta ligeramente el trimmer y prueba luz ambiente. ¿Un cambio de umbral cambia también la fuente de luz?",
    "Prueba el mando IR sin prometer activación. Si no cambia, considera banda espectral, distancia y umbral antes de declarar la pieza rota.",
  ],
  challenge: {
    prompt:
      "Describe una posible falsa alarma óptica y cómo evitarías presentarla como detección segura de incendio.",
    hints: [
      "Una luz puede activar el comparador sin combustión.",
      "Distingue lo medido, intensidad en una banda, de la interpretación, fuego presente.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Puede activarse con luz sin fuego?",
      "Sí, según banda e intensidad",
      ["Nunca", "Solo si tiene Wi-Fi", "Solo al medir temperatura"],
      "El sensor es óptico, no reconoce químicamente la combustión. Su nombre comercial no garantiza una detección exclusiva.",
    ),
    quiz(
      "¿Qué cambia el trimmer?",
      "El umbral de comparación",
      [
        "La temperatura de la habitación",
        "El protocolo USB",
        "La identidad del control remoto",
      ],
      "El ajuste modifica la frontera entre estados del comparador. No convierte el detector en un instrumento certificado.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El mando no activa DO",
      checks: [
        "No todos los emisores coinciden con la banda del detector; prueba luz ambiente segura y revisa el umbral.",
        "Confirma que tienes módulo DO y no sensor desnudo.",
      ],
    },
    serialTrouble,
  ],
});

export const infrared = activity("infrared", {
  stage: "explora",
  icon: "antenna",
  summary:
    "Descifra pulsos invisibles del mando y comprueba comandos NEC sin códigos inventados.",
  concept: {
    title: "Una tecla viaja en tiempos y bits",
    body: [
      "El mando modula luz infrarroja. El receptor elimina la portadora y deja pulsos que la placa puede cronometrar: es como escuchar puntos y rayas, pero con un protocolo preciso.",
      "El ejemplo reconoce NEC, frecuente en mandos de kit. Comprueba cabecera, duración de pulsos y comando invertido. Si el mando usa otro protocolo no adivina una tecla; las repeticiones largas también se omiten en este ejemplo inicial.",
    ],
    facts: [
      { label: "Entrada", value: "GP13, pin 17" },
      { label: "Protocolo", value: "NEC" },
      { label: "Comando", value: "Hexadecimal" },
    ],
  },
  pins: {
    part: "Receptor infrarrojo",
    rows: [
      {
        from: "VCC de receptor compatible con 3,3 V",
        to: "3V3",
        color: "rojo",
      },
      { from: "GND", to: "GND", color: "negro" },
      { from: "OUT", to: "GP13, pin 17", color: "amarillo" },
    ],
    notes: [
      "Identifica el modelo en su ficha: el orden físico de las tres patas cambia entre receptores.",
    ],
  },
  arduino: {
    rows: [
      { from: "VCC de receptor compatible", to: "3V3", color: "rojo" },
      { from: "GND", to: "GND", color: "negro" },
      { from: "OUT", to: "D11", color: "amarillo" },
    ],
    notes: [
      "El ejemplo decodifica NEC sin biblioteca adicional. Comprueba que el receptor admite la alimentación elegida.",
    ],
  },
  safety: [
    "Desconecta USB para montar y confirma pinout real. En Pico no debe existir un pull-up externo a 5 V sobre OUT.",
  ],
  why: "OUT es una secuencia digital de duración variable. El protocolo asigna significado a esos tiempos. Comparar el comando con su inverso ayuda a rechazar mensajes inválidos, pero no vuelve universal la correspondencia entre hexadecimal y nombre de tecla.",
  codeNotes: [
    {
      line: "for bit in range(32):",
      note: "Reconstruye los treinta y dos bits de una trama NEC.",
    },
    {
      line: "command ^ inverse == 255",
      note: "Comprueba que el comando y su campo invertido se complementan.",
    },
  ],
  modify: [
    {
      title: "Pon nombre a una tecla real",
      instruction:
        "Tras la impresión NEC, agrega una comparación de command con un valor que hayas recibido y un mensaje como Tecla de mi mando. No copies valores de otro control.",
      observe:
        "El nombre corresponde a una evidencia de tu mando, no a una tabla universal.",
      arduino: {
        instruction:
          "Dentro de la condición de comando válido, compara command con el hexadecimal que obtuviste y usa Serial.println para nombrarlo.",
      },
    },
  ],
  experiment: [
    "Pulsa tres teclas brevemente y construye una tabla de comando hexadecimal y nombre físico.",
    "Mantén una tecla pulsada. ¿Recibes siempre una trama completa o el mando puede usar un mensaje de repetición?",
  ],
  challenge: {
    prompt:
      "Usa una tecla que mediste para imprimir una orden de encender y otra para apagar, sin inventar códigos.",
    hints: [
      "Primero verifica al menos dos comandos distintos.",
      "Después de validar NEC, usa if y elif para distinguirlos. El siguiente paso podría controlar una salida protegida.",
    ],
    arduino: {
      hints: [
        "Registra dos comandos reales recibidos del mando.",
        "Dentro del bloque de comando válido usa if y else if sobre command y Serial.println para escribir cada orden.",
      ],
    },
  },
  checkpoint: [
    quiz(
      "¿Por qué el código puede no mostrar tu tecla?",
      "El mando puede usar otro protocolo o enviar repetición",
      [
        "Todos los mandos tienen códigos idénticos",
        "Porque IR es una entrada analógica",
        "Porque NEC exige una red de Internet",
      ],
      "El ejemplo valida un protocolo concreto y omite repeticiones. Falta de NEC válido no prueba por sí sola una pieza ausente.",
    ),
    quiz(
      "¿Qué representa el hexadecimal mostrado?",
      "Bits del mensaje recibido",
      [
        "Temperatura del receptor",
        "Potencia del USB",
        "Una identidad universal de la tecla",
      ],
      "El número resume la trama. El significado de una tecla se comprueba con tu mando y no se presupone universal.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Nunca aparece NEC",
      checks: [
        "Revisa OUT al pin correcto, modelo de receptor, tensión y pila del mando.",
        "Pulsa brevemente, apunta al receptor y comprueba que el control usa NEC; otro protocolo requiere otro decodificador.",
      ],
    },
    {
      symptom: "Mantener pulsado no imprime continuamente",
      checks: [
        "Es una limitación explícita del ejemplo: omite tramas de repetición.",
        "Empieza con pulsaciones breves para construir la tabla de comandos completos.",
      ],
    },
  ],
});

export const shiftRegister = activity("shift_register", {
  stage: "explora",
  icon: "board",
  summary:
    "Separa datos, reloj y confirmación usando un 74HC595 para controlar un LED.",
  concept: {
    title: "Guardar ocho decisiones con tres señales",
    body: [
      "Imagina una fila de ocho casilleros. DATA pone el próximo bit y CLOCK lo mueve hacia adentro. Tras enviar ocho, LATCH confirma la fila completa en las salidas.",
      "El 74HC595 permite ahorrar pines de control. No es un driver de potencia: sus salidas y el total del chip tienen límites de corriente. El ejemplo enciende solo un LED protegido en Q0.",
    ],
    facts: [
      { label: "DATA", value: "GP5 / D5" },
      { label: "CLOCK", value: "GP6 / D6" },
      { label: "LATCH", value: "GP7 / D7" },
    ],
  },
  pins: {
    part: "74HC595, muesca identificada",
    rows: [
      { from: "VCC 16 y MR 10", to: "3V3", color: "rojo" },
      { from: "GND 8 y OE 13", to: "GND", color: "negro" },
      { from: "DS 14", to: "GP5, pin 7" },
      { from: "SHCP 11", to: "GP6, pin 9" },
      { from: "STCP 12", to: "GP7, pin 10" },
      { from: "Q0, pin 15", to: "220 Ω → ánodo LED → cátodo a GND" },
    ],
    notes: [
      "Cuenta las patas alrededor de la muesca con la ficha del chip. No conectes motores a Q0.",
    ],
  },
  arduino: {
    rows: [
      { from: "VCC 16 y MR 10", to: "5V", color: "naranja" },
      { from: "GND 8 y OE 13", to: "GND", color: "negro" },
      { from: "DS 14 / SHCP 11 / STCP 12", to: "D5 / D6 / D7" },
      { from: "Q0 15", to: "220 Ω → LED → GND" },
    ],
    notes: [
      "El chip recibe GPIO de 5 V del Uno/Nano, por lo que su alimentación debe ser compatible, no conservar un VCC de 3,3 V.",
    ],
  },
  safety: [
    "Desconecta USB para cablear y confirma orientación del integrado.",
    "Cada LED requiere protección de corriente. Este ejemplo usa una sola salida, sin cargas de potencia.",
  ],
  why: "MR alto permite conservar los bits y OE bajo habilita las salidas. El reloj mueve cada bit y LATCH evita publicar estados intermedios. La tensión del chip debe ser compatible con las señales de la placa que lo controla.",
  codeNotes: [
    {
      line: "for bit in range(7, -1, -1):",
      note: "Envía ocho bits, del más significativo al menos significativo.",
    },
    {
      line: "latch.on()",
      note: "Publica a las salidas el byte que terminó de llegar.",
    },
  ],
  modify: [
    {
      title: "Mueve el bit",
      instruction: "Cambia send(1) por send(2) sin mover el LED de Q0.",
      find: "send(1)",
      replace: "send(2)",
      observe: "Q0 deja de encender, porque el uno pasó a Q1.",
      arduino: {
        instruction: "Cambia sendByte(1) por sendByte(2).",
        find: "sendByte(1)",
        replace: "sendByte(2)",
      },
    },
  ],
  experiment: [
    "Escribe 1 y 2 en binario de ocho bits. ¿Cuál posición activa cada uno?",
    "Explica para qué sirve confirmar con LATCH en lugar de mostrar cada desplazamiento.",
  ],
  challenge: {
    prompt:
      "Predice cuáles de los valores 1, 2 y 3 encienden el LED conectado a Q0, sin agregar más LED.",
    hints: [
      "Q0 representa el bit de peso uno.",
      "1 es 00000001, 2 es 00000010 y 3 es 00000011.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué hace LATCH?",
      "Copia los bits completos a las salidas",
      [
        "Alimenta un motor",
        "Mide la temperatura",
        "Sustituye todas las resistencias",
      ],
      "El registro recibe bits con CLOCK y publica el byte completo con LATCH. No aporta una etapa de potencia.",
    ),
    quiz(
      "¿Por qué Q0 se apaga al enviar 2?",
      "Porque el bit de peso uno vale cero en 2",
      [
        "Porque desaparece la alimentación",
        "Porque el LED invierte su polaridad",
        "Porque 2 supera siempre la corriente",
      ],
      "En binario, 2 es 00000010: Q1 vale uno y Q0 vale cero. La salida representa los bits del byte enviado.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El LED no cambia",
      checks: [
        "Revisa chip orientado por muesca, VCC, GND, MR alto y OE bajo.",
        "Comprueba DS, SHCP, STCP y el LED protegido en Q0, no Q7.",
      ],
    },
    serialTrouble,
  ],
});
