# Tu primera planta conectada

Hoy vas a conocer una parte de Ingeniería Civil Telemática: conectar electrónica, programación y redes para entender algo que ocurre en el mundo real. Tu estación tiene una planta, una placa y un nombre elegido por tu grupo. Tus datos pertenecen a esa estación.

La ruta exprés dura **60 minutos**. No necesitas montar todos los sensores para lograrla: el recorrido central usa LED y sonda de suelo. La ruta completa tiene **33 actividades** para continuar después o ampliar una mesa que avanza más rápido.

## Cómo recorrer una actividad

1. **Entiende:** explica con tus palabras qué hará la pieza. Reconoce el componente y prepara solo lo que necesitas.
2. **Conecta:** quita USB. Sigue un paso a la vez y verifica los extremos; en la vista de protoboard toca un agujero para conocer su conexión. El plano tiene ubicaciones concretas para Pico W. Con otra placa sigue su tabla de pines.
3. **Programa:** conecta USB, autoriza el puerto y ejecuta. Primero predice el resultado. MicroPython se ejecuta en la Pico; un sketch se compila en el servidor y se carga a la placa.
4. **Experimenta:** cambia una sola cosa, vuelve a ejecutar y registra lo observado. «Aplicar cambio» modifica el editor; debes ejecutar después para modificar el hardware. Usa deshacer si quieres comparar.
5. **Comprueba:** responde las preguntas y contrasta el resultado con el objetivo. Completar una actividad registra el avance que tú confirmas; una medalla no certifica por sí sola el circuito físico.

Una buena respuesta tiene tres partes: **predije…, cambié…, observé…**. Si algo no coincide, eso también es un resultado útil: revisa una causa a la vez.

## 1. Descubrir · 5 minutos

Abre el taller y nombra tu estación. Identifica USB, 3V3 y GND. En Pico, **GP2 es pin físico 4**: los dos números significan cosas distintas. Mira la protoboard: cada fila de cinco agujeros comparte conexión; el canal del centro separa ambos lados. Antes de cambiar cables, quita el USB.

## 2. Encender · 8 minutos

Conecta `GP2 → 220 Ω → ánodo del LED`, y `cátodo → GND`. En Arduino usa D2. La pata larga suele ser el ánodo y el lado plano indica el cátodo. Ambas patas no pueden quedar en una fila que las una. Conecta USB y pulsa Conectar; el navegador te pide elegir el puerto de tu placa.

Ejecuta el código del LED. Cambia `led.value(1)` por `led.value(0)` y vuelve a ejecutar. En Arduino cambia `HIGH` por `LOW`, compila y carga. El cambio aparece en el LED real.

Si todavía dudas del puerto o del intérprete, prueba antes «Una luz que ya está en tu placa». No necesita cables extra y usa el LED integrado. Después vuelve al LED externo: ahora tú construyes el camino eléctrico que antes ya venía armado.

## 3. Dar ritmo · 7 minutos

Ejecuta Parpadeo. En MicroPython cambia `intervalo = 0.5`; en Arduino son milisegundos. Prueba un ritmo rápido y uno lento. Un ciclo tiene una pausa encendido y otra apagado. Para pasar al próximo programa, usa Detener en Pico. En Arduino Detener compila y carga un programa de reposo: el sketch anterior continúa hasta que esa carga termina. Detener no desconecta la alimentación; quita USB antes de mover cables.

## 4. Escuchar la tierra · 15 minutos

Desconecta USB. Conecta la sonda: VCC a 3V3, GND a GND y AOUT a **GP26 / pin 31**. En Arduino A0. Solo la zona inferior se entierra; el conector y la electrónica se mantienen secos. No mojes el computador ni la protoboard.

Ejecuta la actividad de suelo. Mira `raw` en la consola. Es una señal real, pero todavía no sabemos cuánto significa. Muévela entre condiciones distintas: aire, tierra seca y tierra húmeda. Si el número no responde, pide revisar el cableado. Un número por sí solo no prueba que el sensor está conectado.

Si queda tiempo, elige DHT11 o DS18B20 en Laboratorio y sigue sus pasos. No conectes 5 V a una entrada de la Pico; HC-SR04 tiene un paso especial con resistencias que revisa el docente.

No mezcles montaje y depuración de muchos sensores: prueba uno solo, observa una respuesta física y después intégralo. En la ruta completa el pulsador controla primero un LED; la LDR transforma luz en voltaje; DHT11 y DS18B20 introducen mensajes digitales; agua, distancia y movimiento amplían las preguntas posibles.

## 5. Dar significado · 10 minutos

En Calibración, guarda una lectura de tierra seca y otra de tierra húmeda. Deja estabilizar y toma ambas con la misma placa y sensor. No tienen que estar en orden creciente. Si casi no difieren, repite la prueba.

La fórmula crea tu escala relativa: seco es 0 %, húmedo es 100 %. No representa un porcentaje exacto de agua dentro del suelo. Cambiar de sensor, alimentación o placa requiere nuevas referencias. Una humedad de 40 % no significa automáticamente “riega”: también importa la planta y cómo hiciste la prueba.

Guardar referencias conserva la calibración de tu grupo. Para aplicarla a las lecturas, instala o reinstala el programa de estación en la siguiente etapa. El ejemplo individual de suelo sigue mostrando RAW; la estación instalada calcula el porcentaje.

## 6. Conectar y observar · 15 minutos

Pulsa Configurar estación en esta etapa para abrir Configuración. Conectar USB vincula el dispositivo automáticamente a tu grupo; no tienes que copiar un código. Selecciona solo los sensores realmente montados y carga el programa de estación para aplicar también tus referencias.

- **Pico W:** configura red Wi-Fi 2.4 GHz y URL indicada por el docente y pulsa Vincular e instalar estación. El programa comienza a leer y enviar datos al terminar la instalación. Esa red debe llegar al servidor. No compartas la contraseña ni la credencial de dispositivo.
- **Arduino Uno/Nano:** pulsa Compilar e instalar estación USB. La transmisión por USB se realiza automáticamente; mantén esta página, el computador y la placa conectados. Arduino no incluye Wi-Fi.

Abre Mi planta y comprueba el origen, la hora y el estado. Crea un umbral de suelo seco adecuado a tus referencias. Retira un poco la sonda o cambia a tierra seca y observa la alerta. El docente puede mostrar la entrega del aviso en Telegram con su bot configurado.

La histéresis pide volver un poco dentro del rango antes de declarar recuperación: evita alarmas que cambian a cada instante junto al límite. La pausa entre avisos limita repeticiones. Comprueba **alerta y recuperación**; ver solo una no prueba ambas direcciones de la regla.

## Si quieres seguir explorando

| Pregunta                               | Actividades                           | Evidencia que puedes observar                                 |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| ¿Cómo decide un programa?              | Pulsador → LED, piezo y buzzer activo | Una entrada cambia una salida; señal y potencia se distinguen |
| ¿Qué cambia alrededor de la planta?    | LDR, DHT11, DS18B20                   | Cambio físico, número, unidad y estado                        |
| ¿Qué hay de agua y movimiento?         | FC-37, nivel, HC-SR04 y PIR           | Comparador, ADC, tiempo de eco y señal retenida               |
| ¿Cómo se dibuja con electrónica?       | 74HC595, displays, matriz y LCD       | Bits, reloj, multiplexación y texto real                      |
| ¿Por qué un motor exige otra revisión? | Paso a paso con ULN2003, señal SG90   | Secuencia frente a energía disponible                         |

Los displays y receptores necesitan identificar su modelo real: no existe un orden universal de patas. La matriz es desnuda y el LCD es paralelo; no se presupone un MAX7219 ni un adaptador I2C. Para SG90, el kit permite estudiar pulsos con LED protegido, pero no se promete movimiento sin una fuente regulada apta que el inventario no incluye. No se realiza riego automático: no hay bomba ni relé comprados.

## Leer los estados

| Estado            | Qué hacer                                                                        |
| ----------------- | -------------------------------------------------------------------------------- |
| READING           | Se obtuvo una lectura; observa unidad, origen y hora                             |
| NEEDS_CALIBRATION | Guarda las dos referencias antes de interpretar el porcentaje                    |
| UNVERIFIED        | Provoca un cambio físico para comprobar respuesta; el dato no confirma presencia |
| NO_RESPONSE       | No hubo respuesta válida; revisa conexiones o condiciones de medida              |
| OUT_OF_RANGE      | Se obtuvo un valor fuera del rango esperado; no lo aceptes automáticamente       |
| DISABLED          | Ese sensor está apagado en la configuración del grupo                            |
| ERROR             | Lee el mensaje y pide ayuda para corregir la causa                               |

La simulación siempre está marcada como **simulación**. Te permite explorar la interfaz; no proviene de tu planta.

## Al terminar

Exporta los datos si quieres conservarlos. Detén la transmisión, desconecta USB y seca la zona de medición de los sensores de agua. Devuelve el kit a su caja. Comparte tres cosas con tu grupo: qué conexión hiciste, qué línea de código cambiaste y por dónde llegaron los datos al dashboard.
