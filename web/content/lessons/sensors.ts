import { activity, quiz, serialTrouble } from "../library";

export const ldr = activity("ldr", {
  stage: 3,
  icon: "sun",
  circuit: "ldr",
  summary:
    "Construye un divisor de voltaje y descubre cómo la luz se convierte en un número.",
  concept: {
    title: "Una resistencia que mira la luz",
    body: [
      "La LDR cambia su resistencia según la iluminación. El ADC de la placa no mide resistencia: mide voltaje. Por eso la acompañas con una resistencia fija y formas un divisor.",
      "La LDR va hacia 3,3 V y la resistencia de 10 kΩ hacia GND. Entre ambas aparece un voltaje que normalmente sube cuando llega más luz. El programa lo convierte en un número crudo, no en lux.",
    ],
    facts: [
      { label: "Señal", value: "GP27, pin 32" },
      { label: "Resistencia", value: "10 kΩ" },
      { label: "Medida", value: "ADC, no lux" },
    ],
  },
  arduino: {
    rows: [
      { from: "Un extremo de la LDR", to: "3V3", color: "rojo" },
      {
        from: "Otro extremo de la LDR",
        to: "A1 y extremo de 10 kΩ",
        color: "amarillo",
      },
      { from: "Otro extremo de 10 kΩ", to: "GND", color: "negro" },
    ],
    notes: [
      "A1 mide respecto a la referencia de 5 V del Uno/Nano. Alimentar el divisor a 3,3 V limita el rango crudo, pero sigue permitiendo observar cambios.",
    ],
  },
  why: "El nodo entre la LDR y 10 kΩ cambia de voltaje sin superar 3,3 V. La resistencia a GND también evita dejar la entrada completamente flotante. Un cambio al tapar y destapar comprueba respuesta física, aunque no identifica automáticamente al componente.",
  codeNotes: [
    { line: "ADC(Pin(27))", note: "Selecciona ADC1 de la Pico, en GP27." },
    {
      line: "range(16)",
      note: "Promedia dieciséis muestras para reducir pequeñas fluctuaciones.",
    },
  ],
  modify: [
    {
      title: "Escucha la luz más despacio",
      instruction:
        "Cambia sleep(1) por sleep(2). En el sketch cambia delay(1000) a delay(2000).",
      find: "sleep(1)",
      replace: "sleep(2)",
      observe:
        "Recibes una lectura cada dos segundos. Cambiar la cadencia no cambia la unidad ni crea una medición en lux.",
      arduino: {
        instruction: "Cambia delay(1000) a delay(2000).",
        find: "delay(1000)",
        replace: "delay(2000)",
      },
    },
  ],
  experiment: [
    "Tapa la LDR con la mano y luego destápala. Anota dos valores raw sin mirar antes la predicción de otro grupo.",
    "Gira la maceta respecto a la luz del aula. ¿Qué ubicación permitiría comparar mediciones sin que tu mano haga sombra?",
  ],
  challenge: {
    prompt:
      "Explica por qué una lectura alta de este montaje significa más luz, pero no dice cuántos lux hay.",
    hints: [
      "El voltaje depende de dos resistencias y de su conexión.",
      "Para lux necesitarías una calibración fotométrica y la respuesta del modelo. Aquí solo medimos una escala relativa.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué mide directamente el ADC?",
      "El voltaje del nodo entre las dos resistencias",
      [
        "La resistencia en ohmios",
        "Los lux exactos del aula",
        "La dirección de la luz",
      ],
      "El ADC convierte un voltaje en un número. El divisor convierte primero el cambio de resistencia de la LDR en voltaje.",
    ),
    quiz(
      "¿Una lectura plausible demuestra que la LDR está conectada?",
      "No; hay que comprobar el montaje y provocar un cambio",
      [
        "Sí, cualquier número lo demuestra",
        "Sí, si es mayor que mil",
        "Solo si el cable es amarillo",
      ],
      "Una entrada flotante o un montaje incorrecto también produce números. Comprobar cómo responde a la luz aporta evidencia física.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Tapar la LDR no cambia el raw",
      checks: [
        "Desconecta USB y revisa LDR hacia 3V3, 10 kΩ hacia GND y señal al nodo compartido.",
        "La señal debe llegar a GP27, no al pin GP26 usado por la sonda de suelo.",
      ],
    },
    {
      symptom: "Esperabas un número en lux",
      checks: [
        "El ejemplo entrega raw y NEEDS_CALIBRATION; es intencional.",
        "En la estación el valor de luz es relativo al ADC. No lo compares con lux de un instrumento.",
      ],
    },
  ],
});

export const lm35 = activity("lm35", {
  stage: 3,
  icon: "thermometer",
  circuit: "lm35",
  summary:
    "Relaciona voltaje y temperatura usando la escala de 10 mV por grado del LM35.",
  concept: {
    title: "Un termómetro que entrega voltios",
    body: [
      "El LM35 funciona como una regla eléctrica: cada grado Celsius produce aproximadamente 10 mV en su salida. A 25 °C esperarías 0,25 V.",
      "El programa convierte el raw del ADC a voltaje y después multiplica por cien para estimar grados. La referencia del ADC y el modelo real introducen error: este cálculo no reemplaza una calibración de laboratorio.",
    ],
    facts: [
      { label: "Escala", value: "10 mV/°C" },
      { label: "Alimentación", value: "VBUS, 5 V" },
      { label: "Lectura", value: "GP26, pin 31" },
    ],
  },
  safety: [
    "Desconecta USB antes de cablear. Confirma el pinout del encapsulado; una conexión invertida puede calentarlo.",
    "El LM35 necesita al menos 4 V: solo su alimentación usa VBUS. VOUT llega al ADC y debe permanecer por debajo de 3,3 V.",
    "Retira antes la sonda de suelo o el potenciómetro de GP26. Esta es una actividad individual, no un cuarto ADC para la estación.",
  ],
  arduino: {
    rows: [
      { from: "LM35 +VS", to: "5V", color: "naranja" },
      { from: "LM35 VOUT", to: "A0", color: "amarillo" },
      { from: "LM35 GND", to: "GND", color: "negro" },
    ],
    notes: [
      "Verifica la ficha del modelo. Retira cualquier otro sensor conectado a A0 antes de probar.",
    ],
  },
  why: "El sensor necesita 5 V de alimentación, pero su señal representa milivoltios por grado y en el rango ambiental queda por debajo de 3,3 V. Alimentación y salida no son lo mismo. La estación ya reserva sus tres ADC para suelo, luz y nivel de agua.",
  codeNotes: [
    {
      line: "volts = raw * 3.3 / 65535",
      note: "Convierte la escala de MicroPython a voltaje suponiendo una referencia de 3,3 V.",
    },
    {
      line: "volts * 100",
      note: "Diez milivoltios por grado equivalen a multiplicar voltios por cien.",
    },
  ],
  modify: [
    {
      title: "Muestra también el voltaje",
      instruction:
        "Agrega print(" +
        '"Voltaje:", round(volts, 3), "V"' +
        ") debajo del cálculo volts. En el sketch imprime la variable volts.",
      observe:
        "Puedes comprobar las dos escalas: cerca de 0,25 V corresponde a cerca de 25 °C.",
    },
  ],
  experiment: [
    "Compara la temperatura estimada con el DHT11 del grupo. ¿Una diferencia demuestra automáticamente que uno está roto?",
    "Calcula primero el voltaje esperado a 20 °C y a 30 °C. Luego compara con la lectura real del aula.",
  ],
  challenge: {
    prompt:
      "Muestra grados y voltaje en una misma línea sin cambiar el pin ni la alimentación.",
    hints: [
      "Las dos variables ya existen en el código.",
      "Un print puede recibir varios valores separados por comas.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué voltaje corresponde aproximadamente a 25 °C?",
      "0,25 V",
      ["2,5 V", "25 V", "0 V"],
      "La escala es 10 mV por grado: 25 por 10 mV son 250 mV, equivalentes a 0,25 V.",
    ),
    quiz(
      "¿Por qué no agregas este sensor al GP26 ocupado por suelo?",
      "Dos salidas no deben compartir la misma entrada ADC",
      [
        "Porque ambos miden exactamente lo mismo",
        "Porque el cable negro no puede compartirse",
        "Porque el LM35 necesita Internet",
      ],
      "GND puede ser común, pero dos salidas de sensores en el mismo ADC se interfieren. Se prueba uno por vez en esa entrada.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El LM35 se calienta",
      checks: [
        "Desconecta la alimentación inmediatamente.",
        "Comprueba encapsulado y pinout con el docente antes de volver a alimentar. No inviertas por ensayo y error.",
      ],
    },
    {
      symptom: "La estimación de temperatura es absurda",
      checks: [
        "Revisa que VOUT llegue a GP26 y que no siga conectada otra salida en ese nodo.",
        "Comprueba GND común y que la conversión del código corresponde a la placa seleccionada.",
      ],
    },
  ],
});

export const dht11 = activity("dht11", {
  stage: 4,
  icon: "thermometer",
  circuit: "dht11",
  summary:
    "Recibe temperatura y humedad del aire en un mensaje digital y reconoce errores reales.",
  concept: {
    title: "Dos medidas viajan por un mismo cable",
    body: [
      "El DHT11 ya calcula temperatura y humedad dentro del sensor. En vez de entregar un voltaje proporcional, envía una secuencia de bits por DATA: un pequeño mensaje.",
      "La placa comprueba si ese mensaje llegó a tiempo y si su suma de verificación coincide. Eso permite detectar falta de respuesta, pero no garantiza exactitud absoluta. El sensor es lento: deja al menos dos segundos entre mediciones.",
    ],
    facts: [
      { label: "DATA", value: "GP15, pin 20" },
      { label: "Intervalo", value: "≥ 2 s" },
      { label: "Mensajes", value: "°C y % HR" },
    ],
  },
  safety: [
    "Desconecta USB antes de conectar. El plano representa un módulo de tres patas; sigue las marcas de tu unidad, no una posición asumida.",
    "Solo usa 3,3 V si la ficha de tu DHT11 lo admite. No conectes un pull-up de 5 V a GP15.",
    "Sensor suelto de cuatro patas: confirma VCC, DATA, NC y GND y agrega 10 kΩ entre DATA y 3,3 V. Mantén el sensor seco.",
  ],
  arduino: {
    rows: [
      { from: "DHT11 VCC", to: "5V", color: "naranja" },
      { from: "DHT11 DATA", to: "D4", color: "amarillo" },
      { from: "DHT11 GND", to: "GND", color: "negro" },
      {
        from: "DATA si no hay pull-up integrado",
        to: "10 kΩ → 5V",
        note: "Solo para la variante cuya ficha permita esta alimentación.",
      },
    ],
    notes: [
      "En Uno/Nano el sketch usa la biblioteca DHT instalada en el compilador. No reutilices la alimentación de 3,3 V del sensor junto con señales de 5 V.",
      "Retira el pulsador que use D4 antes de este montaje.",
    ],
  },
  why: "DATA necesita un estado alto definido mediante pull-up. La alimentación debe coincidir con el nivel lógico permitido por tu placa y variante. El mismo cable transporta dos variables: no necesitas dos entradas para medir el aire.",
  codeNotes: [
    {
      line: "dht.DHT11(Pin(15))",
      note: "Selecciona el modelo DHT11 y la línea GP15.",
    },
    {
      line: "sensor.measure()",
      note: "Pide una medición y valida el mensaje antes de leer sus dos campos.",
    },
    {
      line: "except OSError as error:",
      note: "Convierte un fallo de comunicación en NO_RESPONSE sin inventar una temperatura.",
    },
  ],
  modify: [
    {
      title: "Dale más tiempo",
      instruction:
        "Cambia la última pausa de 2 a 3 segundos. En el sketch cambia delay(2000) a delay(3000). No reduzcas el intervalo por debajo de dos segundos.",
      find: "    sleep(2)",
      replace: "    sleep(3)",
      observe: "Recibes el mismo par de variables con menor frecuencia.",
      arduino: {
        instruction:
          "Cambia delay(2000) por delay(3000). Conserva al menos dos segundos entre lecturas.",
        find: "delay(2000)",
        replace: "delay(3000)",
      },
    },
  ],
  experiment: [
    "Acerca la mano sin tocar ni mojar la rejilla. Observa varias lecturas: el efecto no es instantáneo.",
    "Compara dos DHT11 del aula sin juntarlos con cables. ¿Qué efecto tienen ubicación, corriente de aire y precisión limitada?",
  ],
  challenge: {
    prompt:
      "Explica qué diferencia hay entre una humedad de 0 % y una medición sin respuesta.",
    hints: [
      "El valor y el estado son campos distintos del mensaje.",
      "Sin respuesta debe haber value nulo y NO_RESPONSE, no un cero inventado.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Por qué esperar al menos dos segundos?",
      "El DHT11 tiene una cadencia de medición limitada",
      [
        "Para que el Wi-Fi cargue la pantalla",
        "Porque DATA es una entrada analógica",
        "Porque la humedad siempre sube cada segundo",
      ],
      "Consultar demasiado rápido no aumenta la precisión y puede producir errores. El ejemplo respeta el ritmo del sensor.",
    ),
    quiz(
      "¿Qué demuestra un checksum válido?",
      "Que el mensaje recibido pasó su comprobación de integridad",
      [
        "Que la temperatura es exacta",
        "Que nunca habrá un cable suelto",
        "Que la planta necesita riego",
      ],
      "La verificación ayuda a detectar bits corruptos. No sustituye la precisión especificada ni una calibración del instrumento.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Aparece NO_RESPONSE",
      checks: [
        "Desconecta USB; confirma tensión admitida por la unidad, pinout y DATA en GP15.",
        "Comprueba el pull-up del módulo o agrega 10 kΩ si es sensor suelto. Espera dos segundos entre lecturas.",
      ],
    },
    serialTrouble,
  ],
});

export const soil = activity("soil", {
  stage: 5,
  essential: true,
  duration: 15,
  icon: "sprout",
  circuit: "soil",
  summary:
    "Empieza por una sonda: conecta la maceta al código y compara tierra seca y húmeda.",
  concept: {
    title: "La tierra modifica una señal",
    body: [
      "La sonda capacitiva no necesita que sus pistas metálicas toquen directamente el agua. El entorno cambia su capacitancia y la electrónica produce un voltaje relacionado con esa condición.",
      "El ADC convierte ese voltaje en raw, un número crudo. Es como una regla sin etiquetas: hasta que midas referencias de tu propia sonda, no sabes qué número representa seco o húmedo.",
      "En esta etapa basta la sonda de suelo. Si avanzas rápido, añade DHT11 o DS18B20 siguiendo su actividad completa. La estación con todos los sensores es una ampliación, no una carrera por conectar todo de golpe.",
    ],
    facts: [
      { label: "Modelo", value: "Capacitive v1.2" },
      { label: "AOUT", value: "GP26, pin 31" },
      { label: "Pico raw", value: "0–65535" },
      { label: "Sketch raw", value: "0–1023" },
    ],
  },
  safety: [
    "Desconecta USB para cablear. VCC de la sonda va a 3,3 V. En la Pico, AOUT nunca debe superar 3,3 V; no conectes AOUT al riel de alimentación.",
    "Entierra solo la zona sensora hasta su marca. El conector y la electrónica superior quedan secos, lejos de agua y tierra mojada.",
    "Retira LM35 o potenciómetro de GP26 si los probaste antes. Un ADC lee una sola salida en este montaje.",
  ],
  arduino: {
    rows: [
      { from: "Sonda VCC", to: "3V3", color: "rojo" },
      { from: "Sonda GND", to: "GND", color: "negro" },
      { from: "Sonda AOUT", to: "A0", color: "amarillo" },
    ],
    notes: [
      "El raw usa una referencia ADC de 5 V y un rango de 0–1023. Calibra con esos números, sin copiar los de otro modelo de placa.",
    ],
  },
  why: "VCC y GND alimentan la electrónica; AOUT lleva solo la señal al ADC. Mantener la misma sonda, profundidad y alimentación hace comparables tus referencias. Una entrada analógica puede entregar números aun sin sensor: provocar un cambio y revisar el montaje es indispensable.",
  expected:
    "La terminal muestra JSON con raw una vez por segundo. value queda nulo y el estado es NEEDS_CALIBRATION: faltan referencias. Anota diez lecturas con la sonda quieta, luego compara tierra seca y húmeda a la misma profundidad. Una diferencia repetible permite avanzar a Calibración; un número aislado no demuestra respuesta física.",
  sampleOutput:
    '{"sensor":"soil","value":null,"raw":42000,"unit":"%","status":"NEEDS_CALIBRATION"}\nEjemplo de formato, no una lectura de tu planta.',
  codeNotes: [
    {
      line: "sensor = ADC(Pin(26))",
      note: "Lee el voltaje de AOUT en ADC0, no el pin físico 26.",
    },
    {
      line: "sum(sensor.read_u16() for _ in range(16)) // 16",
      note: "Promedia dieciséis muestras. Reduce ruido, sin convertir el resultado en humedad exacta.",
    },
    {
      line: '"value": None',
      note: "El porcentaje aún no está definido; un valor nulo comunica esa ausencia sin rellenarlo con cero.",
    },
  ],
  modify: [
    {
      title: "Observa el ruido",
      instruction:
        "Cambia la expresión del promedio por sensor.read_u16(). En el sketch usa una muestra en vez de dieciséis y ajusta el divisor.",
      find: "sum(sensor.read_u16() for _ in range(16)) // 16",
      replace: "sensor.read_u16()",
      observe:
        "La lectura puede fluctuar más. El promedio suaviza pequeñas variaciones, pero no arregla un cable incorrecto.",
      arduino: {
        instruction:
          "Reemplaza todo el bloque de promedio por int raw = analogRead(A0); para conservar el formato del mensaje.",
        find: "  long total = 0;\n  for (int i = 0; i < 16; i++) total += analogRead(A0);\n  int raw = total / 16;",
        replace: "  int raw = analogRead(A0);",
      },
    },
  ],
  experiment: [
    "Mide aire, tierra seca y tierra húmeda sin mojar la electrónica. Escribe los valores y observa en qué dirección cambia tu sonda.",
    "Cambia la profundidad dentro de una misma maceta. ¿Sigue siendo justo comparar porcentajes si la geometría del montaje cambia?",
    "Mantén la sonda quieta y registra diez valores. Decide si ya está lo bastante estable para calibrar.",
  ],
  challenge: {
    prompt:
      "Predice qué referencia será mayor en tu sonda y verifica la predicción antes de construir un porcentaje.",
    hints: [
      "No todas las sondas o montajes cambian en la misma dirección.",
      "Anota raw seco y raw húmedo con la misma profundidad. La fórmula posterior acepta cualquiera de los dos órdenes.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Por qué value aparece nulo aunque hay raw?",
      "Faltan referencias para definir un porcentaje relativo",
      [
        "La planta no tiene humedad",
        "El navegador inventó el número",
        "El raw siempre es un porcentaje",
      ],
      "El ADC ya produjo una lectura. Sin calibración, convertirla a porcentaje sería asignar significado sin una referencia física.",
    ),
    quiz(
      "¿Qué evidencia ayuda a comprobar la sonda?",
      "Que raw responde al cambiar la condición física y el cableado está revisado",
      [
        "Que aparece cualquier número",
        "Que el LED de la pantalla anima",
        "Que otro grupo tiene el mismo raw",
      ],
      "Una entrada flotante también genera números. La respuesta al entorno y la revisión eléctrica aportan evidencia de una señal real.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El raw no responde al pasar de seco a húmedo",
      checks: [
        "Desconecta USB: revisa 3V3, GND y AOUT a GP26, con la salida de otros sensores retirada.",
        "Inserta la zona sensora a igual profundidad y espera estabilidad. Si sigue sin responder, prueba un repuesto con el docente.",
      ],
    },
    {
      symptom: "El porcentaje está vacío",
      checks: [
        "Es correcto antes de calibrar: mira raw y NEEDS_CALIBRATION.",
        "Sigue la etapa de calibración y luego reinstala la estación para aplicar tus dos referencias.",
      ],
    },
  ],
});

export const ds18b20 = activity("ds18b20", {
  stage: 5,
  icon: "thermometer",
  circuit: "ds18b20",
  summary:
    "Descubre un sensor con identidad digital y mide temperatura junto a las raíces.",
  concept: {
    title: "Un termómetro con nombre propio",
    body: [
      "Cada DS18B20 tiene una dirección digital, como una identificación. La placa puede buscarla en el bus 1-Wire y distinguir una respuesta real de la ausencia de dispositivos.",
      "Una medición no aparece inmediatamente al pedirla. A resolución de 12 bits, la conversión puede tardar 750 ms. El programa busca, solicita, espera y lee; saltarse la espera puede entregar un dato anterior.",
    ],
    facts: [
      { label: "DATA", value: "GP16, pin 21" },
      { label: "Pull-up", value: "2 × 10 kΩ paralelo" },
      { label: "Conversión", value: "750 ms" },
    ],
  },
  safety: [
    "Desconecta USB antes de cablear. Usa alimentación de tres hilos, no modo parásito.",
    "Confirma el pinout del proveedor: el color de un cable no es una norma. Solo la punta impermeable entra en el suelo; protege el empalme y conector.",
  ],
  arduino: {
    rows: [
      { from: "DS18B20 VCC", to: "3V3", color: "rojo" },
      { from: "DS18B20 GND", to: "GND", color: "negro" },
      { from: "DS18B20 DATA", to: "D5", color: "amarillo" },
      {
        from: "DATA",
        to: "3V3 mediante dos resistencias de 10 kΩ en paralelo",
        note: "Ambas resistencias comparten los dos extremos: equivalen a 5 kΩ.",
      },
    ],
    notes: [
      "El sketch usa OneWire y DallasTemperature, disponibles en el compilador del proyecto.",
    ],
  },
  why: "El bus necesita un pull-up para volver a nivel alto. Dos resistencias de 10 kΩ en paralelo producen 5 kΩ usando el kit existente. En serie serían 20 kΩ, que no es el mismo montaje. La búsqueda de ROM y la validación digital permiten detectar falta de respuesta sin derribar otros drivers.",
  codeNotes: [
    {
      line: "sensor.scan()",
      note: "Busca las identidades que responden en GP16.",
    },
    {
      line: "sensor.convert_temp()",
      note: "Solicita una conversión nueva; todavía no es el momento de leer.",
    },
    {
      line: "sleep_ms(750)",
      note: "Espera el tiempo de conversión a máxima resolución.",
    },
  ],
  modify: [
    {
      title: "Muestra las identidades",
      instruction:
        "Agrega print(" +
        '"Dispositivos:", [r.hex() for r in roms]' +
        ") justo después de scan. En el sketch puedes imprimir el conteo de dispositivos.",
      observe:
        "Ves la identidad de tu sensor. No es el valor de temperatura ni el nombre de tu grupo.",
    },
  ],
  experiment: [
    "Sujeta la punta metálica con la mano unos segundos. ¿Por qué la respuesta tarda más que un cambio de estado de un botón?",
    "Con USB desconectado, revisa las dos resistencias: ¿comparten ambos extremos o quedó una detrás de otra?",
  ],
  challenge: {
    prompt:
      "Explica por qué encontrar una ROM y pedir una conversión son comprobaciones distintas.",
    hints: [
      "Buscar confirma quién respondió en el bus.",
      "La conversión produce una medición nueva; leer requiere además esperar y validar los datos.",
    ],
  },
  checkpoint: [
    quiz(
      "Dos resistencias de 10 kΩ en paralelo equivalen a…",
      "5 kΩ",
      ["20 kΩ", "10 kΩ", "0 Ω"],
      "En paralelo ambas conducen entre los mismos dos nodos. Dos resistencias iguales dividen su valor equivalente por dos.",
    ),
    quiz(
      "¿Qué haces después de pedir una conversión?",
      "Esperar hasta 750 ms antes de leer",
      [
        "Leer inmediatamente un valor anterior",
        "Conectar DATA a 5 V",
        "Cambiar el sensor de identidad",
      ],
      "La conversión toma tiempo. El programa espera antes de leer para obtener un resultado de la petición actual.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "No se encontró DS18B20",
      checks: [
        "Revisa pinout real y DATA a GP16 con USB desconectado.",
        "Comprueba alimentación y el pull-up de dos 10 kΩ en paralelo. Instala el firmware de estación si faltan onewire o ds18x20.",
      ],
    },
    {
      symptom: "La temperatura se queda cerca de 85 °C",
      checks: [
        "No aceptes el valor inicial como medición. Comprueba que se solicita convert_temp y se espera la conversión.",
        "Revisa alimentación estable y conexiones antes de asumir un entorno a esa temperatura.",
      ],
    },
  ],
});

export const rain = activity("rain", {
  stage: 6,
  icon: "drop",
  circuit: "rain",
  summary:
    "Compara gotas con un umbral físico y descubre qué puede decir una señal digital.",
  concept: {
    title: "¿Hay agua sobre estas pistas?",
    body: [
      "La placa FC-37 cambia su señal cuando agua une parte de sus pistas. El LM393 compara esa señal con un límite ajustado por la pequeña perilla del módulo.",
      "DO responde con sí o no. En el módulo activo bajo habitual, el programa invierte la entrada para mostrar 1 cuando detecta agua. Esto no mide milímetros de lluvia y un nivel constante no comprueba presencia del sensor.",
    ],
    facts: [
      { label: "Usamos", value: "DO, no AO" },
      { label: "Entrada", value: "GP14, pin 19" },
      { label: "Salida", value: "0/1" },
    ],
  },
  safety: [
    "Desconecta USB para cablear. Alimenta el LM393 a 3,3 V en este montaje.",
    "Aplica gotas solo en la placa sensora. Mantén secos módulo, conectores y protoboard; seca las pistas al terminar para reducir corrosión.",
  ],
  arduino: {
    rows: [
      { from: "LM393 VCC", to: "3V3", color: "rojo" },
      { from: "LM393 GND", to: "GND", color: "negro" },
      { from: "LM393 DO", to: "D6", color: "amarillo" },
      { from: "Placa FC-37", to: "Conector de dos hilos del módulo" },
    ],
    notes: [
      "El código asume salida activa baja. Confirma la polaridad de tu módulo con una prueba seca y otra con una gota.",
    ],
  },
  why: "La señal analógica de la placa se compara en el módulo, no en el ADC de la Pico. La entrada GP14 lee el resultado digital y deja disponibles los tres ADC para suelo, luz y nivel. La polaridad debe comprobarse físicamente.",
  codeNotes: [
    {
      line: "1 - sensor.value()",
      note: "Invierte la salida activa baja para expresar 1 como contacto de agua.",
    },
    {
      line: '"status": "UNVERIFIED"',
      note: "Un bit no identifica al sensor. Verifica respuesta provocando una condición física.",
    },
  ],
  modify: [
    {
      title: "Compara antes de invertir",
      instruction:
        "Cambia 1 - sensor.value() por sensor.value(). En el sketch retira el 1 - de digitalRead.",
      find: "1 - sensor.value()",
      replace: "sensor.value()",
      observe:
        "Los estados seco/mojado se invierten en el mensaje. El agua y el umbral físico siguen iguales.",
      arduino: {
        instruction:
          "Quita la inversión de la lectura digital para observar la polaridad original.",
        find: "1 - digitalRead(6)",
        replace: "digitalRead(6)",
      },
    },
  ],
  experiment: [
    "Anota el bit con placa seca y con una sola gota, sin mojar el módulo.",
    "Gira ligeramente el trimmer. ¿La misma gota activa siempre el comparador? Devuelve el ajuste después de la prueba.",
  ],
  challenge: {
    prompt:
      "Explica la diferencia entre el umbral del trimmer y una regla de alerta de la web.",
    hints: [
      "El trimmer afecta la señal antes de llegar a la placa.",
      "Una regla de la web interpreta una lectura que ya fue recibida por el servidor.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué significa un 1 de lluvia en este ejemplo?",
      "Que el comparador está en la condición asociada a agua",
      [
        "Un milímetro de lluvia",
        "Una conexión digital con identidad verificada",
        "Un litro de agua",
      ],
      "La salida solo representa una comparación. No mide volumen ni intensidad de precipitación.",
    ),
    quiz(
      "¿Qué parte puedes mojar con una gota?",
      "Solo la placa sensora de pistas",
      ["El módulo LM393 completo", "La protoboard", "El puerto USB"],
      "La placa expuesta es la superficie de prueba. La electrónica y sus conexiones se mantienen secas para evitar daños.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "El estado parece invertido",
      checks: [
        "Haz una prueba seca y otra con gota; anota el raw digital del módulo.",
        "La inversión del ejemplo es para activo bajo. Ajusta la fórmula si tu unidad usa la polaridad contraria.",
      ],
    },
    {
      symptom: "Nunca cambia",
      checks: [
        "Comprueba que conectaste DO y no AO a GP14.",
        "Revisa el conector de la placa FC-37 y ajusta el trimmer sin aplicar agua sobre el módulo.",
      ],
    },
  ],
});

export const water = activity("water_level", {
  stage: 6,
  icon: "drop",
  circuit: "water",
  summary:
    "Observa cómo cambia una señal al mojar las pistas y construye tu propia escala de nivel.",
  concept: {
    title: "Una superficie mojada se vuelve señal",
    body: [
      "El sensor de nivel tiene pistas expuestas. Al mojar más superficie, la conductividad del agua cambia su salida analógica. El ADC la transforma en raw.",
      "El número depende del agua, del sensor y de la profundidad. Para llamarlo porcentaje defines vacío y un máximo seguro del montaje. No se convierte automáticamente en centímetros ni litros.",
    ],
    facts: [
      { label: "Señal", value: "GP28, pin 34" },
      { label: "Unidad calibrada", value: "% relativo" },
      { label: "Electrónica", value: "Siempre seca" },
    ],
  },
  safety: [
    "Desconecta USB antes de conectar. Alimenta a 3,3 V para no exceder el ADC de la Pico.",
    "Sumerge solo las pistas, nunca el conector ni la electrónica superior. No uses el sensor en recipientes con alimentación eléctrica externa.",
    "Es resistivo y puede corroerse: haz pruebas breves, seca al terminar y no lo dejes permanentemente energizado en el agua.",
  ],
  arduino: {
    rows: [
      { from: "Sensor +", to: "3V3", color: "rojo" },
      { from: "Sensor −", to: "GND", color: "negro" },
      { from: "Sensor S", to: "A2", color: "amarillo" },
    ],
    notes: [
      "Calibra con raw de tu placa y el mismo recipiente. No copies referencias de la Pico.",
    ],
  },
  why: "La salida S va a su propio ADC, GP28, separado de suelo y luz. VCC y GND son compartidos como referencia, pero cada salida analógica permanece independiente. Un raw plausible no verifica que la sonda esté conectada.",
  codeNotes: [
    {
      line: "ADC(Pin(28))",
      note: "Selecciona ADC2 para no mezclar esta señal con suelo o luz.",
    },
  ],
  modify: [
    {
      title: "Compara cadencias",
      instruction:
        "Cambia sleep(1) por sleep(2). En el sketch usa delay(2000).",
      find: "sleep(1)",
      replace: "sleep(2)",
      observe:
        "El sensor sigue respondiendo físicamente, pero lees el cambio con menos frecuencia.",
      arduino: {
        instruction: "Cambia delay(1000) a delay(2000).",
        find: "delay(1000)",
        replace: "delay(2000)",
      },
    },
  ],
  experiment: [
    "Registra raw fuera del agua y al máximo permitido por las pistas. Marca ese máximo en el recipiente.",
    "Compara media altura con el promedio de los dos raw. ¿La respuesta parece lineal? No asumas que sí.",
  ],
  challenge: {
    prompt:
      "Calibra vacío y máximo en la herramienta y describe qué significa un 50 % para tu recipiente.",
    hints: [
      "Selecciona Nivel de agua en la calibración, no Suelo.",
      "Ese porcentaje describe tus referencias; no promete mitad del volumen del recipiente.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Un 50 % relativo garantiza mitad del volumen?",
      "No; depende de la calibración, respuesta y recipiente",
      [
        "Sí, para cualquier recipiente",
        "Sí, si el sensor es rojo",
        "Solo cuando el USB es nuevo",
      ],
      "La escala interpola entre dos señales. Forma del recipiente y conductividad impiden asumir automáticamente una relación con litros.",
    ),
    quiz(
      "¿Cuál es la entrada asignada?",
      "GP28, ADC2",
      [
        "GP26 compartido con suelo",
        "VBUS como entrada",
        "El riel rojo de alimentación",
      ],
      "Cada salida analógica necesita su propio ADC. El montaje final reserva GP28 para nivel de agua.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "La lectura cambia poco",
      checks: [
        "Comprueba que S llega a GP28 y que hay GND común.",
        "Confirma que solo las pistas están mojadas y que la muestra no cambió de conductividad entre referencias.",
      ],
    },
    {
      symptom: "Los extremos calibrados casi coinciden",
      checks: [
        "Seca completamente las pistas antes de registrar vacío.",
        "Usa el mismo sensor, alimentación y máximo seguro. Si no responde, pide revisar o cambiar la unidad.",
      ],
    },
  ],
});

export const distance = activity("distance", {
  stage: 6,
  icon: "wave",
  circuit: "hcsr04",
  summary:
    "Cronometra un eco y protege la entrada de la Pico con un divisor de cinco resistencias.",
  concept: {
    title: "Medir distancia escuchando el regreso",
    body: [
      "El HC-SR04 envía un pulso de sonido y mide cuánto tarda el eco. Como el sonido viaja hasta el objeto y vuelve, la distancia usa la mitad del recorrido.",
      "TRIG ordena la medición y ECHO indica su duración. El módulo se alimenta a 5 V y ECHO también puede alcanzar 5 V: el divisor lo reduce a aproximadamente 3 V antes de GP18.",
    ],
    facts: [
      { label: "TRIG", value: "GP17, pin 22" },
      { label: "ECHO reducido", value: "GP18, pin 24" },
      { label: "Divisor", value: "2 kΩ / 3 kΩ" },
      { label: "Espera de eco", value: "30 ms máximo" },
    ],
  },
  safety: [
    "Desconecta USB antes de cablear y pide revisar el divisor antes de alimentar.",
    "ECHO nunca llega directo a la Pico. ECHO → dos resistencias de 1 kΩ → nodo → tres resistencias de 1 kΩ → GND. Solo el nodo llega a GP18.",
    "VCC va a VBUS de 5 V, separado de los rieles rojos de 3,3 V. No sustituyas el divisor por un único resistor en serie.",
  ],
  arduino: {
    rows: [
      { from: "HC-SR04 VCC", to: "5V", color: "naranja" },
      { from: "HC-SR04 GND", to: "GND", color: "negro" },
      { from: "HC-SR04 TRIG", to: "D7", color: "verde" },
      { from: "HC-SR04 ECHO", to: "D8", color: "amarillo" },
    ],
    notes: [
      "Uno/Nano AVR trabaja con lógica de 5 V y acepta ECHO directo en D8. Esa conexión no sirve para una placa de 3,3 V.",
    ],
  },
  why: "La proporción del divisor es 3/(2+3): de 5 V resulta aproximadamente 3 V. Las cinco resistencias del kit cumplen dos funciones distintas a ambos lados del nodo. La fórmula distancia = tiempo × velocidad / 2 evita contar dos veces el viaje del sonido.",
  codeNotes: [
    {
      line: "time_pulse_us(echo, 1, 30000)",
      note: "Mide un pulso alto en microsegundos y limita la espera para no quedar bloqueado sin eco.",
    },
    {
      line: "duration * 0.0343 / 2",
      note: "Convierte tiempo a centímetros usando una velocidad aproximada y divide el viaje de ida y vuelta.",
    },
  ],
  modify: [
    {
      title: "Muestra el tiempo de viaje",
      instruction:
        "Agrega print(" +
        '"Eco:", duration, "µs"' +
        ") antes de calcular cm. En el sketch imprime us.",
      observe:
        "Al alejar un objeto plano, aumentan tanto el tiempo como la distancia calculada.",
    },
  ],
  experiment: [
    "Compara 10, 20 y 30 cm usando una regla y una superficie plana perpendicular al sensor.",
    "Inclina el objeto o cambia por una tela. ¿Sin eco significa necesariamente sensor ausente?",
  ],
  challenge: {
    prompt:
      "Explica por qué un único resistor en serie no reemplaza al divisor que protege GP18.",
    hints: [
      "Una entrada de alta impedancia consume muy poca corriente.",
      "Sin el camino hacia GND no se define la proporción de voltaje. El nodo debe tener resistencias hacia ECHO y hacia GND.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué voltaje entrega el nodo del divisor 2 kΩ / 3 kΩ con ECHO a 5 V?",
      "Aproximadamente 3 V",
      ["5 V", "9 V", "0 V siempre"],
      "El nodo está sobre las tres resistencias hacia GND: 5 por 3 dividido por 5 equivale a unos 3 V.",
    ),
    quiz(
      "¿Por qué se divide por dos al calcular distancia?",
      "Porque el sonido hace ida y vuelta",
      [
        "Porque hay dos ojos en el módulo",
        "Porque el GPIO es de 3,3 V",
        "Porque el sensor es analógico",
      ],
      "El tiempo medido incluye llegar al objeto y regresar. Dividir por dos obtiene la distancia en un solo sentido.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Aparece NO_RESPONSE",
      checks: [
        "Prueba un objeto plano entre 2 y 400 cm, perpendicular a los transductores.",
        "Desconecta USB y revisa alimentación de 5 V, TRIG, ECHO y el nodo del divisor. No retires el divisor para probar.",
      ],
    },
    {
      symptom: "La distancia es inestable",
      checks: [
        "Evita tela, bordes y superficies inclinadas que dispersan el eco.",
        "No hagas disparos muy seguidos ni cruces dos sensores cercanos: conserva la cadencia del ejemplo.",
      ],
    },
  ],
});

export const motion = activity("motion", {
  stage: 6,
  icon: "activity",
  circuit: "pir",
  summary:
    "Detecta cambios de movimiento infrarrojo y aprende por qué quieto no significa ausente.",
  concept: {
    title: "Percibir cambios, no identificar personas",
    body: [
      "El PIR compara radiación infrarroja en zonas de su lente. Un cuerpo que se mueve entre ellas produce un cambio. No crea imágenes ni sabe quién eres.",
      "Después de alimentar necesita aproximadamente un minuto para estabilizarse. La salida puede quedarse alta un tiempo tras el movimiento y una persona quieta puede dejar de detectarse. Un bit fijo tampoco permite identificar un cable suelto.",
    ],
    facts: [
      { label: "Alimentación", value: "VBUS, 5 V" },
      { label: "OUT", value: "GP19, pin 25" },
      { label: "Estabilización", value: "60 s" },
    ],
  },
  safety: [
    "Desconecta USB antes de montar. Confirma el pinout en la placa real, no mirando solo la cúpula.",
    "El HC-SR501 habitual entrega una salida de 3,3 V aunque use alimentación de 5 V. Confirma ese nivel antes de conectar a GP19.",
  ],
  arduino: {
    rows: [
      { from: "HC-SR501 VCC", to: "5V", color: "naranja" },
      { from: "HC-SR501 GND", to: "GND", color: "negro" },
      { from: "HC-SR501 OUT", to: "D9", color: "amarillo" },
    ],
    notes: [
      "Espera un minuto tras alimentar antes de interpretar el resultado. Ajusta retención y sensibilidad con los trimmers según la unidad.",
    ],
  },
  why: "La alimentación sostiene la electrónica del PIR y OUT transporta una señal digital independiente. No alimentes desde un GPIO. El tiempo de retención explica por qué el 1 puede durar más que el movimiento que lo causó.",
  codeNotes: [
    {
      line: "Pin(19, Pin.IN, Pin.PULL_DOWN)",
      note: "Lee la salida del módulo en GP19 con una referencia baja interna.",
    },
    {
      line: '"status": "UNVERIFIED"',
      note: "Un estado fijo no demuestra identidad ni ausencia. Comprueba respuesta después del calentamiento.",
    },
  ],
  modify: [
    {
      title: "Observa la retención",
      instruction:
        "Cambia sleep(0.5) por sleep(1). En el sketch cambia delay(500) a delay(1000).",
      find: "sleep(0.5)",
      replace: "sleep(1)",
      observe:
        "Puedes contar aproximadamente cuántos segundos permanece 1 después de un movimiento.",
      arduino: {
        instruction: "Cambia delay(500) por delay(1000).",
        find: "delay(500)",
        replace: "delay(1000)",
      },
    },
  ],
  experiment: [
    "Espera un minuto, mueve la mano y luego déjala inmóvil. Anota el tiempo aproximado que permanece la salida alta.",
    "Compara cruzar frente al sensor y acercarte de frente. ¿La lente divide el espacio de manera relevante?",
  ],
  challenge: {
    prompt:
      "Describe una alerta útil basada en movimiento que no afirme identificar ni contar personas.",
    hints: [
      "El sensor solo comunica cambios de radiación y un estado retenido.",
      "Un aviso de movimiento cerca de la estación es más defendible que un conteo de estudiantes.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué significa que un PIR deje de marcar movimiento?",
      "Que no detecta cambios; una persona puede seguir ahí quieta",
      [
        "Que no hay ninguna persona",
        "Que desconectó el USB",
        "Que midió distancia cero",
      ],
      "El PIR responde a cambios infrarrojos entre zonas. No es un sensor de identidad ni de presencia permanente.",
    ),
    quiz(
      "¿Cuándo empiezas a interpretar sus primeros datos?",
      "Después de dejarlo estabilizar cerca de un minuto",
      [
        "Durante el primer instante de alimentación",
        "Solo después de mojarlo",
        "Cuando el raw llegue a 65535",
      ],
      "El HC-SR501 necesita estabilización. El ejemplo individual muestra bits, pero los primeros cambios pueden pertenecer al arranque.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "La salida permanece alta",
      checks: [
        "Espera calentamiento y el tiempo de retención configurado antes de concluir un fallo.",
        "Evita corrientes térmicas, sol directo y movimiento cercano; revisa el ajuste del módulo.",
      ],
    },
    {
      symptom: "No reacciona al movimiento",
      checks: [
        "Desconecta USB; revisa VCC a 5 V, GND y OUT al pin asignado.",
        "Confirma nivel de salida y sensibilidad del modelo con el docente; prueba cruzar lateralmente frente a la lente.",
      ],
    },
  ],
});
