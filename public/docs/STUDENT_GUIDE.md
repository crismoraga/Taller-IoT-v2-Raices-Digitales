# Tu primera planta conectada

Hoy vas a conocer una parte de Ingeniería Civil Telemática: conectar electrónica, programación y redes para entender algo que ocurre en el mundo real. Tu estación tiene una planta, una placa y un nombre elegido por tu grupo. Tus datos pertenecen a esa estación.

## 1. Descubrir · 5 minutos

Abre el taller y nombra tu estación. Identifica USB, 3V3 y GND. En Pico, **GP2 es pin físico 4**: los dos números significan cosas distintas. Mira la protoboard: cada fila de cinco agujeros comparte conexión; el canal del centro separa ambos lados. Antes de cambiar cables, quita el USB.

## 2. Encender · 8 minutos

Conecta `GP2 → 220 Ω → ánodo del LED`, y `cátodo → GND`. En Arduino usa D2. La pata larga suele ser el ánodo y el lado plano indica el cátodo. Ambas patas no pueden quedar en una fila que las una. Conecta USB y pulsa Conectar; el navegador te pide elegir el puerto de tu placa.

Ejecuta el código del LED. Cambia `led.value(1)` por `led.value(0)` y vuelve a ejecutar. En Arduino cambia `HIGH` por `LOW`, compila y carga. El cambio aparece en el LED real.

## 3. Dar ritmo · 7 minutos

Ejecuta Parpadeo. En MicroPython cambia `intervalo = 0.5`; en Arduino son milisegundos. Prueba un ritmo rápido y uno lento. Un ciclo tiene una pausa encendido y otra apagado. Para pasar al próximo programa, usa Detener en Pico. En Arduino el programa sigue en la placa hasta cargar otro o quitar alimentación.

## 4. Escuchar la tierra · 15 minutos

Desconecta USB. Conecta la sonda: VCC a 3V3, GND a GND y AOUT a **GP26 / pin 31**. En Arduino A0. Solo la zona inferior se entierra; el conector y la electrónica se mantienen secos. No mojes el computador ni la protoboard.

Ejecuta la actividad de suelo. Mira `raw` en la consola. Es una señal real, pero todavía no sabemos cuánto significa. Muévela entre condiciones distintas: aire, tierra seca y tierra húmeda. Si el número no responde, pide revisar el cableado. Un número por sí solo no prueba que el sensor está conectado.

Si queda tiempo, elige DHT11 o DS18B20 en Laboratorio y sigue sus pasos. No conectes 5 V a una entrada de la Pico; HC-SR04 tiene un paso especial con resistencias que revisa el docente.

## 5. Dar significado · 10 minutos

En Calibración, guarda una lectura de tierra seca y otra de tierra húmeda. Deja estabilizar y toma ambas con la misma placa y sensor. No tienen que estar en orden creciente. Si casi no difieren, repite la prueba.

La fórmula crea tu escala relativa: seco es 0 %, húmedo es 100 %. No representa un porcentaje exacto de agua dentro del suelo. Cambiar de sensor, alimentación o placa requiere nuevas referencias. Una humedad de 40 % no significa automáticamente “riega”: también importa la planta y cómo hiciste la prueba.

Guardar referencias conserva la calibración de tu grupo. Para aplicarla a las lecturas, instala o reinstala el programa de estación en la siguiente etapa. El ejemplo individual de suelo sigue mostrando RAW; la estación instalada calcula el porcentaje.

## 6. Conectar y observar · 15 minutos

Pulsa Configurar estación en esta etapa para abrir Configuración. Conectar USB vincula el dispositivo automáticamente a tu grupo; no tienes que copiar un código. Selecciona solo los sensores realmente montados y carga el programa de estación para aplicar también tus referencias.

- **Pico W:** configura red Wi-Fi 2.4 GHz y URL indicada por el docente y pulsa Vincular e instalar estación. El programa comienza a leer y enviar datos al terminar la instalación. Esa red debe llegar al servidor. No compartas la contraseña ni la credencial de dispositivo.
- **Arduino Uno/Nano:** pulsa Compilar e instalar estación USB. La transmisión por USB se realiza automáticamente; mantén esta página, el computador y la placa conectados. Arduino no incluye Wi-Fi.

Abre Mi planta y comprueba el origen, la hora y el estado. Crea un umbral de suelo seco adecuado a tus referencias. Retira un poco la sonda o cambia a tierra seca y observa la alerta. El docente puede mostrar la entrega del aviso en Telegram con su bot configurado.

## Leer los estados

| Estado | Qué hacer |
|---|---|
| READING | Se obtuvo una lectura; observa unidad, origen y hora |
| NEEDS_CALIBRATION | Guarda las dos referencias antes de interpretar el porcentaje |
| UNVERIFIED | Provoca un cambio físico para comprobar respuesta; el dato no confirma presencia |
| NO_RESPONSE | No hubo respuesta válida; revisa conexiones o condiciones de medida |
| OUT_OF_RANGE | Se obtuvo un valor fuera del rango esperado; no lo aceptes automáticamente |
| DISABLED | Ese sensor está apagado en la configuración del grupo |
| ERROR | Lee el mensaje y pide ayuda para corregir la causa |

La simulación siempre está marcada como **simulación**. Te permite explorar la interfaz; no proviene de tu planta.

## Al terminar

Exporta los datos si quieres conservarlos. Detén la transmisión, desconecta USB y seca la zona de medición de los sensores de agua. Devuelve el kit a su caja. Comparte tres cosas con tu grupo: qué conexión hiciste, qué línea de código cambiaste y por dónde llegaron los datos al dashboard.
