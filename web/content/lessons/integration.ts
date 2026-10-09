import { activity, quiz } from "../library";
import type { Lesson } from "../types";

export const calibration = activity("calibration", {
  stage: 5,
  essential: true,
  summary:
    "Guarda dos referencias reales y convierte raw en una escala que puedes explicar.",
  duration: 10,
  icon: "sliders",
  circuit: "soil",
  tool: "calibration",
  materials: [
    { name: "Sonda conectada y comprobada", qty: 1 },
    {
      name: "Tierra seca y tierra húmeda",
      note: "Misma sonda y profundidad; no inundes la maceta.",
    },
    { name: "Papel para secar y registrar el montaje" },
  ],
  concept: {
    title: "Una regla necesita sus marcas",
    body: [
      "Calibrar aquí es darle dos marcas a tu regla: el raw que decides llamar seco y el raw que decides llamar húmedo. Entre ambos, el programa calcula una posición relativa.",
      "La fórmula es 100 × (raw − seco) / (húmedo − seco), limitada a 0–100. Funciona aunque el número disminuya con más humedad. Si los extremos casi coinciden, no hay suficiente separación para una escala útil.",
      "Un 40 % de esta escala no significa 40 % de agua dentro de la tierra ni una instrucción universal de riego. Cambiar sonda, placa, profundidad o alimentación requiere revisar las referencias.",
    ],
    facts: [
      { label: "Seco", value: "0 % relativo" },
      { label: "Húmedo", value: "100 % relativo" },
      { label: "Aplicación", value: "Reinstalar estación" },
    ],
  },
  safety: [
    "Mantén seca la electrónica superior de la sonda y la protoboard.",
    "Desconecta USB antes de mover cables. Las dos referencias se toman con la misma placa, sonda, alimentación y profundidad.",
  ],
  arduino: {
    rows: [
      { from: "Sonda VCC", to: "3V3", color: "rojo" },
      { from: "Sonda GND", to: "GND", color: "negro" },
      { from: "Sonda AOUT", to: "A0", color: "amarillo" },
    ],
    notes: [
      "Ejecuta el ejemplo, copia raw seco y húmedo y escríbelos en la herramienta. Son valores de 0–1023; no copies referencias de 0–65535.",
    ],
  },
  why: "El ADC mide voltaje, no humedad. Dos condiciones físicas registradas crean una escala para ese montaje. Capturar en Pico promedia veinte muestras; guardar conserva las referencias del grupo, y reinstalar la estación las incorpora al programa que calcula los porcentajes.",
  expected:
    "La herramienta guarda seco y húmedo si tienen separación suficiente: al menos 500 unidades en Pico o 8 en el sketch. Después instala o reinstala la estación. El ejemplo individual de esta página continúa entregando raw, sin porcentaje; guardar no modifica ese ejemplo automáticamente.",
  codeNotes: [
    {
      line: '"status": "NEEDS_CALIBRATION"',
      note: "Este ejemplo es la regla sin marcas. La herramienta guarda referencias y el programa de estación instalado las aplica.",
    },
  ],
  modify: [
    {
      title: "Define tus dos marcas",
      instruction:
        "En la herramienta captura Seco, cambia a tierra húmeda, espera estabilidad y captura Húmedo. Guarda las referencias. Si usaste aire para seco, deja constancia: no equivale a tierra seca.",
      observe:
        "Aparecen dos números de tu montaje y la calibración queda guardada solo para tu grupo.",
    },
    {
      title: "Comprueba un punto intermedio",
      instruction:
        "Instala la estación desde Estación para aplicar referencias. Prueba una condición intermedia y comprueba el valor recibido en Mi planta.",
      observe:
        "El porcentaje queda entre tus dos referencias; fuera de ellas se limita al rango 0–100.",
    },
  ],
  experiment: [
    "Calcula a mano el porcentaje del raw situado justo a la mitad entre seco y húmedo. Luego compáralo con el programa de estación.",
    "Compara tus referencias con otro grupo sin copiarlas. ¿Por qué no deben coincidir necesariamente?",
  ],
  challenge: {
    prompt:
      "Explica qué significaría invertir accidentalmente las etiquetas seco y húmedo y cómo comprobarías el error.",
    hints: [
      "La fórmula acepta una escala creciente o decreciente, pero necesita etiquetas físicas correctas.",
      "Vuelve a una condición seca conocida y verifica que el porcentaje se aproxime a cero, no a cien.",
    ],
  },
  checkpoint: [
    quiz(
      "El raw baja al humedecer. ¿La calibración sigue siendo posible?",
      "Sí, la fórmula acepta extremos en cualquier orden numérico",
      [
        "No, siempre debe subir",
        "Solo si cambias la placa",
        "Solo usando un sensor de lluvia",
      ],
      "El denominador puede ser negativo. Lo necesario es que cada extremo esté etiquetado correctamente y suficientemente separado.",
    ),
    quiz(
      "Guardaste referencias. ¿Cómo las aplicas a la telemetría?",
      "Instalando o reinstalando el programa de estación",
      [
        "Cambiando el nombre de la planta",
        "Esperando a que el ejemplo raw cambie solo",
        "Copiando el porcentaje de otro grupo",
      ],
      "Las referencias se conservan en tu grupo y se incluyen al generar el firmware de estación. El ejemplo individual no se reescribe al guardarlas.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "No permite guardar los extremos",
      checks: [
        "Comprueba que ambos campos tienen números dentro del rango de tu placa y que no son casi iguales.",
        "Repite seco y húmedo con la misma profundidad y espera una señal estable. Si no responde, revisa antes el cableado.",
      ],
    },
    {
      symptom: "El dashboard todavía muestra NEEDS_CALIBRATION",
      checks: [
        "Guardar la referencia es solo el primer paso. Instala de nuevo la estación para cargarla en la placa.",
        "Comprueba que calibraste Suelo y no Nivel de agua, y que habilitaste la sonda correcta.",
      ],
    },
  ],
});

export const station: Lesson = {
  id: "station",
  stage: 7,
  title: "Tu planta reúne al equipo",
  summary:
    "Integra los sensores que ya probaste sin cruzar sus señales ni inventar lecturas.",
  duration: 15,
  icon: "board",
  circuit: "station",
  tool: "station",
  objective:
    "Instalar un programa con drivers independientes y comprobar la respuesta de cada sensor realmente montado.",
  materials: [
    { name: "Pico W con USB de datos", qty: 1 },
    { name: "LED, 220 Ω y sensores ya probados" },
    { name: "Planta con suelo y protoboard", qty: 1 },
    {
      name: "Resistencias del kit para pull-ups y divisor",
      note: "Solo si montaste DS18B20, DHT11 suelto o HC-SR04.",
    },
  ],
  concept: {
    title: "Integrar no es empezar de nuevo",
    body: [
      "Cada sensor conserva su lugar y su señal. La estación reúne sus drivers: pequeñas piezas de programa que saben leer cada modelo y comunicar valor, unidad y estado.",
      "Empieza con suelo y LED. Agrega un sensor por vez, tras probarlo solo. Un problema de DHT11 debe producir un estado de error en ese driver, sin detener la lectura del suelo.",
      "Activa en Estación solo los sensores que realmente montaste. Guardar calibraciones o cambiar la selección requiere reinstalar el programa para que la placa use esa configuración.",
    ],
    facts: [
      { label: "ADC0", value: "Suelo GP26" },
      { label: "ADC1", value: "Luz GP27" },
      { label: "ADC2", value: "Nivel GP28" },
      { label: "Drivers", value: "8 modelos / 9 variables" },
    ],
  },
  safety: [
    "Desconecta USB antes de añadir un componente. Revisa una señal nueva cada vez.",
    "El plano completo incluye un piezo pasivo con resistencia. Un buzzer activo requiere ULN2003 y su propia actividad; no lo reemplaces directamente.",
    "Antes de usar HC-SR04, pide verificar su divisor 2 kΩ / 3 kΩ. Mantén VBUS de 5 V separado de los rieles de 3,3 V.",
  ],
  arduino: {
    rows: [
      { from: "Sonda AOUT", to: "A0" },
      { from: "Nodo LDR + 10 kΩ", to: "A1" },
      { from: "Nivel S", to: "A2" },
      { from: "DHT11 DATA", to: "D4" },
      { from: "DS18B20 DATA + pull-up", to: "D5" },
      { from: "LM393 DO", to: "D6" },
      { from: "HC-SR04 TRIG / ECHO", to: "D7 / D8" },
      { from: "PIR OUT", to: "D9" },
      { from: "LED mediante 220 Ω / piezo mediante 220 Ω", to: "D2 / D3" },
      { from: "GND de todos los módulos", to: "GND" },
    ],
    notes: [
      "Usa además la alimentación y notas de seguridad de la actividad de cada modelo; la tabla resume señales, no sustituye esas conexiones.",
      "DHT11 usa alimentación compatible con lógica de 5 V. Los analógicos pueden conservar 3,3 V con su calibración propia. Uno/Nano envía datos mediante el puente USB de esta página.",
    ],
  },
  why: "Tres ADC leen tres salidas diferentes. Los sensores digitales usan sus líneas asignadas. Todos comparten GND para interpretar señales con la misma referencia, pero no comparten salidas. Los drivers aíslan fallos y describen límites: UNVERIFIED no es lo mismo que presencia comprobada.",
  expected:
    "En Estación: conecta, activa solo lo instalado, comprueba calibraciones y pulsa la instalación correspondiente a tu placa. La terminal entrega lotes JSON y Mi planta recibe datos de tu dispositivo. Si no montaste un sensor, su estado debe estar deshabilitado, no inventarse un valor.",
  modify: [
    {
      title: "Crece de uno en uno",
      instruction:
        "Activa solo Suelo e instala. Provoca un cambio real, luego añade un segundo sensor con USB desconectado y reinstala con ese sensor habilitado.",
      observe:
        "Puedes atribuir cada nueva lectura a una conexión que acabas de comprobar.",
    },
    {
      title: "Aísla un fallo",
      instruction:
        "Deshabilita desde Estación un sensor que vayas a retirar y reinstala. Retira su cable solo después de quitar USB.",
      observe:
        "El resto de la estación sigue leyendo; no sustituyes la ausencia por datos falsos.",
    },
  ],
  experiment: [
    "Señala las tres entradas analógicas del plano y explica por qué LM35 no se suma como un cuarto ADC.",
    "Haz una prueba física de cada sensor habilitado y registra valor, unidad y estado. Un bit constante requiere más evidencia que una identidad digital encontrada.",
  ],
  challenge: {
    prompt:
      "Construye una lista de verificación de tres evidencias para declarar lista tu estación.",
    hints: [
      "Una evidencia debe ser eléctrica y otra debe demostrar respuesta física.",
      "Añade recepción en Mi planta con origen hardware, hora reciente y el dispositivo de tu grupo.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué habilitas en la estación?",
      "Solo los sensores realmente montados y revisados",
      [
        "Todos para tener más tarjetas",
        "Todos los comprados aunque sigan en la caja",
        "Solo los que muestran un número simulado",
      ],
      "La selección configura los drivers instalados. Habilitar un sensor ausente dificulta interpretar errores y no crea una medición real.",
    ),
    quiz(
      "¿Qué puede hacer un driver si falla su sensor?",
      "Reportar su error sin bloquear los demás drivers",
      [
        "Inventar el último valor como si fuera nuevo",
        "Borrar la sesión del grupo",
        "Declarar cero sin estado",
      ],
      "El programa maneja cada modelo por separado y comunica el fallo. Un dato nulo con estado es más informativo que un número fabricado.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "Un sensor nuevo afecta a varios",
      checks: [
        "Quita USB y revisa corto entre rieles, GND común, consumo y señal compartida accidentalmente.",
        "Vuelve a la última configuración que funcionaba y agrega una pieza por vez.",
      ],
    },
    {
      symptom: "Cambiaste configuración pero la placa sigue igual",
      checks: [
        "Guardar selección no actualiza por sí solo el programa ya instalado.",
        "Instala de nuevo y verifica el lote de lecturas y diagnósticos de la placa.",
      ],
    },
  ],
};

export const cloud = activity("cloud", {
  stage: 8,
  essential: true,
  title: "Tus raíces llegan a la red",
  summary:
    "Instala tu estación, recibe tus datos y crea una alerta: hardware, software y redes juntos.",
  duration: 15,
  icon: "wifi",
  tool: "station",
  code: undefined,
  arduinoCode: undefined,
  objective:
    "Enviar telemetría real de tu grupo, observarla en el dashboard y comprobar una regla de alerta.",
  concept: {
    title: "La telemetría es el viaje de una medición",
    body: [
      "Telemetría significa medir aquí y comunicar el resultado a otro lugar. Cada mensaje incluye qué sensor midió, qué valor obtuvo, en qué unidad y con qué estado.",
      "La Pico W puede conectarse por Wi-Fi de 2,4 GHz y enviar por HTTPS al servidor. Si la red falla, sigue leyendo y el puente USB del navegador puede transmitir. En Uno/Nano, el camino de red lo realiza el computador mediante ese puente.",
      "El dispositivo tiene una credencial de tu grupo. El servidor conserva los datos separados y envía actualizaciones a tu dashboard. Una alerta se evalúa sobre una lectura recibida, no sobre una animación de la página.",
    ],
    facts: [
      { label: "Pico W", value: "Wi-Fi 2,4 GHz / USB" },
      { label: "Uno/Nano", value: "Puente USB" },
      { label: "Transporte", value: "HTTPS" },
      { label: "Cadencia habitual", value: "5 s" },
    ],
  },
  materials: [
    { name: "Sonda de suelo montada y calibrada" },
    { name: "USB de datos y computador con el taller abierto" },
    {
      name: "Wi-Fi de 2,4 GHz accesible al servidor",
      note: "Solo para el envío autónomo de Pico W; no se necesita un módulo extra.",
    },
  ],
  safety: [
    "No compartas contraseña Wi-Fi ni credencial del dispositivo en capturas o mensajes.",
    "La URL debe ser accesible desde la placa. localhost desde Pico nombra a la propia Pico, no al computador del docente.",
  ],
  why: "El firmware instalado contiene selección de sensores, referencias y vinculación de tu grupo. HTTPS verifica el servidor y protege el mensaje. El bridge USB necesita la página abierta; el envío Wi-Fi de Pico puede continuar sin ella mientras tenga alimentación y red.",
  expected:
    "Abre Estación, conecta USB, activa los sensores realmente montados e instala. Para Pico W usa la red y URL HTTPS indicadas por el docente. Para Uno/Nano compila e instala la estación USB y mantén la página abierta. Luego Mi planta muestra hardware, hora reciente y tus valores calibrados; crea allí una regla de suelo y comprueba una alerta con un cambio físico.",
  modify: [
    {
      title: "Elige tu camino de red",
      instruction:
        "En Estación configura red y URL si usarás Pico W autónoma. Instala y observa el diagnóstico de conexión. Si usas el puente, conserva USB y página abiertos.",
      observe:
        "La terminal sigue siendo evidencia local; Mi planta confirma que la medición llegó al servidor.",
    },
    {
      title: "Del dato a una decisión",
      instruction:
        "En Mi planta agrega un umbral acorde a tu escala de suelo. Provoca una condición por debajo del mínimo y después vuelve a una condición normal.",
      observe:
        "Aparece una alerta y luego una recuperación. La simulación se identifica aparte y no se envía al bot.",
    },
  ],
  experiment: [
    "Señala cada salto de tu camino real: sensor, placa, USB o Wi-Fi, servidor y dashboard. No basta nombrar nube.",
    "Compara la hora y el origen de dos lecturas. ¿Cómo detectarías que la curva que estás mirando dejó de actualizarse?",
  ],
  challenge: {
    prompt:
      "Explica una alerta de suelo seco indicando dónde se mide, dónde se interpreta y quién envía el aviso del bot.",
    hints: [
      "La placa convierte la señal y el servidor evalúa la regla.",
      "El bot configurado por el docente recibe alertas reales desde el servidor; el navegador muestra su registro.",
    ],
  },
  checkpoint: [
    quiz(
      "¿El Uno/Nano obtiene Wi-Fi al instalar el sketch?",
      "No; el computador transmite mediante el puente USB abierto",
      [
        "Sí, aparece una antena por software",
        "Sí, el cable USB es una red inalámbrica",
        "Solo si el sensor está húmedo",
      ],
      "El inventario no agrega un módulo inalámbrico al Uno/Nano. El navegador conectado transporta sus lecturas al servidor.",
    ),
    quiz(
      "¿Qué prueba que tu planta llegó al servidor?",
      "Una lectura reciente de tu dispositivo con origen hardware",
      [
        "Una animación bonita",
        "Una lectura de simulación",
        "Que el LED esté encendido",
      ],
      "El LED y la consola prueban acciones locales. La recepción autenticada y el origen hardware prueban el siguiente tramo del viaje.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "La Pico no se conecta al Wi-Fi",
      checks: [
        "Revisa red de 2,4 GHz, contraseña y ausencia de portal cautivo.",
        "Comprueba alcance y restricciones de la red con el docente. Puedes continuar por el puente USB si el computador llega al servidor.",
      ],
    },
    {
      symptom: "Hay lecturas seriales pero no aparecen en Mi planta",
      checks: [
        "Confirma URL accesible, certificado HTTPS, vinculación y sensores habilitados.",
        "Para el puente mantén página y USB conectados. Mira hora, origen y dispositivo en lugar de asumir que una curva anterior sigue en vivo.",
      ],
    },
  ],
});

export const dashboard: Lesson = {
  id: "dashboard",
  stage: 9,
  title: "Lee el pulso de tu planta",
  summary:
    "Distingue un valor, su historia, su origen y la confianza que puedes darle.",
  duration: 6,
  icon: "chart",
  tool: "dashboard",
  objective:
    "Interpretar lecturas actuales e históricas distinguiendo datos reales, simulados y estados de medición.",
  materials: [
    { name: "Estación instalada y transmitiendo" },
    { name: "Navegador con sesión de tu grupo" },
  ],
  concept: {
    title: "Un número cuenta más cuando tiene contexto",
    body: [
      "Una tarjeta es como una foto; la curva es como una película. Una muestra muestra un instante y el historial permite reconocer tendencias, ruido y momentos sin datos.",
      "Antes de interpretar mira sensor, unidad, hora, estado y origen. Un porcentaje relativo no es una medida universal, y un cero válido no significa lo mismo que un valor nulo por falta de respuesta.",
      "La simulación sirve para practicar la interfaz y los umbrales. Siempre se rotula como simulación: sus cambios no son evidencia de una planta real.",
    ],
    facts: [
      { label: "Origen real", value: "Hardware" },
      { label: "Práctica", value: "Simulación explícita" },
      { label: "Conservar", value: "Exportación CSV" },
    ],
  },
  why: "El dashboard recibe actualizaciones del servidor y conserva histórico por grupo. Filtrar origen impide mezclar un ensayo virtual con una medición física. Cada estado limita qué conclusión puedes sacar del valor.",
  expected:
    "Abre Mi planta y filtra Hardware. Selecciona una variable, cambia el rango temporal y consulta una muestra de la curva. Exporta CSV para conservar sus registros. Si no llegó telemetría, la vista debe mostrar ausencia de datos; puedes practicar con el simulador rotulado.",
  modify: [
    {
      title: "Cambia la pregunta, no los datos",
      instruction:
        "Selecciona Suelo y un rango corto. Luego cambia a un rango más largo y observa las mismas lecturas en contexto.",
      observe:
        "Una variación pequeña puede parecer grande o pequeña según el intervalo observado. La unidad no cambia.",
    },
    {
      title: "Separa práctica y evidencia",
      instruction:
        "Abre Practicar sin hardware, envía una lectura y compara los filtros Hardware y Simulación. Desactiva el simulador después.",
      observe:
        "La muestra virtual aparece con su origen y no modifica físicamente la planta.",
    },
  ],
  experiment: [
    "Provoca un cambio suave en la sonda y busca cuándo apareció en la curva. ¿Hay un retardo respecto de tu mano?",
    "Exporta CSV y identifica sensor, hora, origen, valor y estado. ¿Qué columna necesitas para evitar tratar un fallo como cero?",
  ],
  challenge: {
    prompt:
      "Escribe una conclusión de dos frases sobre tu planta usando una tendencia y una limitación de la medición.",
    hints: [
      "Describe lo observado, por ejemplo aumentó la lectura relativa durante cinco minutos.",
      "Agrega una limitación: escala propia, profundidad, ubicación, origen o última hora recibida.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Qué revisas antes de comparar dos lecturas?",
      "Unidad, origen, hora, estado y referencia del montaje",
      [
        "Solo cuál número es mayor",
        "Solo el color de la tarjeta",
        "Que los nombres de grupos sean iguales",
      ],
      "Comparar valores sin contexto puede mezclar escalas, prácticas simuladas o datos antiguos con mediciones actuales.",
    ),
    quiz(
      "¿Cómo interpretas un valor nulo con NO_RESPONSE?",
      "No hubo una medición válida para ese instante",
      [
        "La temperatura es cero",
        "La tierra está completamente seca",
        "La planta dejó de existir",
      ],
      "Un nulo comunica falta de un valor válido. Sustituirlo por cero llevaría a una interpretación física incorrecta.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "La curva no tiene datos",
      checks: [
        "Comprueba que tu estación está enviando y que elegiste el origen correcto.",
        "Prueba un rango temporal mayor y observa la última hora recibida. Sin datos no se dibuja una curva inventada.",
      ],
    },
    {
      symptom: "El gráfico muestra números inesperados",
      checks: [
        "Comprueba si son datos de simulación o lecturas raw sin calibración.",
        "Revisa sensor, unidad y estado antes de cambiar umbrales.",
      ],
    },
  ],
};

export const alerts: Lesson = {
  id: "alerts",
  stage: 10,
  title: "La planta pide atención",
  summary:
    "Convierte una observación en una regla y comprueba su alerta y recuperación.",
  duration: 7,
  icon: "bell",
  tool: "alerts",
  objective:
    "Definir y verificar un umbral con histéresis y distinguir una alerta local de un aviso entregado al bot.",
  materials: [
    { name: "Estación transmitiendo datos calibrados" },
    {
      name: "Bot y chat configurados por el docente",
      note: "La alerta del dashboard funciona aunque el bot no esté configurado.",
    },
  ],
  concept: {
    title: "Una decisión necesita una regla y contexto",
    body: [
      "Un umbral define cuándo prestar atención. Por ejemplo, una lectura de suelo por debajo de tu mínimo puede generar una alerta. Primero debes entender tu escala: no existe un mínimo único para todas las plantas.",
      "La histéresis exige volver un poco dentro del rango antes de declarar recuperación. Evita encender y apagar una alarma cuando el número tiembla junto al límite. La pausa entre avisos limita repeticiones, sin borrar el problema.",
      "El servidor evalúa las próximas lecturas y registra el evento. El docente puede configurar Telegram y comprobar entrega. Una alerta registrada no demuestra que el mensaje externo se entregó; son dos resultados distintos.",
    ],
    facts: [
      { label: "Umbral", value: "Mínimo / máximo" },
      { label: "Estabilidad", value: "Histéresis" },
      { label: "Repetición", value: "Pausa en segundos" },
    ],
  },
  why: "La decisión se toma sobre mensajes válidos que llegaron al servidor. Cada grupo tiene sus reglas y datos. La simulación permite probar cruces y recuperación con seguridad, pero no genera avisos de Telegram como si fueran hardware real.",
  expected:
    "En Mi planta crea una regla sobre Suelo: rango e histéresis adecuados a tus referencias y una pausa entre avisos. Envía una lectura fuera del rango y luego vuelve suficientemente dentro. Observa alerta y recuperación. Para Telegram el docente configura el bot en Profesor y prueba primero el chat; solo se anuncia entrega si el servicio la confirma.",
  modify: [
    {
      title: "Prueba la frontera",
      instruction:
        "En simulación explícita crea un mínimo de 30 y una histéresis de 3 para suelo. Envía 29, luego 31 y después 34. Usa la prueba para entender la regla; decide después tus límites físicos.",
      observe:
        "29 genera alerta; 31 puede seguir en estado de alarma; 34 cruza el margen de recuperación.",
    },
    {
      title: "Comprueba con tu planta",
      instruction:
        "Cierra el simulador, filtra Hardware y provoca una condición real que cruce tu propio umbral. Vuelve al rango y verifica recuperación.",
      observe:
        "El registro conserva el origen real. El docente puede revisar por separado la entrega del bot.",
    },
  ],
  experiment: [
    "Compara un límite con histéresis cero y con un margen pequeño usando simulación rotulada. ¿Qué cambia cerca de la frontera?",
    "Explica a otro grupo qué harías ante NO_RESPONSE: no debería interpretarse como suelo a 0 %.",
  ],
  challenge: {
    prompt:
      "Diseña una alerta que un compañero pueda interpretar sin preguntarte qué significa el número.",
    hints: [
      "Incluye sensor, unidad, límite y grupo; distingue lectura de fallo.",
      "Explica acción razonable: comprobar sensor y planta antes de regar. Este kit no incluye bomba ni relé para riego automático.",
    ],
  },
  checkpoint: [
    quiz(
      "¿Para qué sirve la histéresis?",
      "Para pedir un margen de regreso y evitar cambios repetidos junto al límite",
      [
        "Para aumentar la precisión del sensor",
        "Para convertir raw a lux",
        "Para enviar la contraseña Wi-Fi",
      ],
      "La histéresis cambia las condiciones de recuperación de la regla. No modifica la medición ni corrige su precisión.",
    ),
    quiz(
      "¿Una alerta registrada confirma entrega por Telegram?",
      "No; hay que comprobar el resultado de entrega del bot",
      [
        "Sí, siempre",
        "Sí, aunque no exista token",
        "Solo si la simulación está activa",
      ],
      "El evento y la comunicación externa son pasos separados. Token, chat y conexión del servidor deben funcionar para que el aviso se entregue.",
    ),
  ],
  troubleshooting: [
    {
      symptom: "No aparece una alerta al guardar la regla",
      checks: [
        "La regla se evalúa con próximas lecturas: recibe o envía una muestra nueva.",
        "Revisa sensor, unidad, estado válido y origen; no uses raw como si ya fuera porcentaje.",
      ],
    },
    {
      symptom: "La alerta aparece pero no llega al bot",
      checks: [
        "El docente debe comprobar token, chat y conversación iniciada con el bot.",
        "Confirma que el evento proviene de hardware; simulación no se envía. Revisa el resultado de entrega, no solo el registro local.",
      ],
    },
  ],
};
