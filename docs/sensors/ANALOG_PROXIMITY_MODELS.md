# Modelos 3D de sensores analógicos y de proximidad

Los cuerpos están implementados en [AnalogProximityModels.tsx](../../web/experience/sensors/AnalogProximityModels.tsx). Son geometrías originales generadas en el navegador con Three.js; no descargan modelos, fotos, texturas ni fuentes externas durante el taller.

## Qué se representa

| Pieza del taller               | Rasgos visibles                                                                                                                                                                | Referencia de proporciones                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Sonda de suelo capacitiva v1.2 | PCB negra larga, punta redondeada continua, zona de medida recubierta, electrónica en el extremo del conector. No tiene la horquilla de dos electrodos de una sonda resistiva. | Familia capacitiva larga de aproximadamente 98 × 23 mm.                         |
| FC-37 + LM393                  | Dos tarjetas separadas: placa con pistas alternadas y agujeros reales de montaje; tarjeta LM393 con encapsulado de ocho patas, ajuste azul y dos hilos entre ambas.            | Placa de gotas de unos 50 × 40 mm; tarjeta de control larga de unos 32 × 14 mm. |
| Nivel de agua                  | Tarjeta alargada roja, diez dedos conductores dorados unidos alternadamente a dos buses, componentes en el extremo del conector.                                               | Variante de placa de unos 19 × 63 mm.                                           |
| HC-SR04                        | PCB azul vertical de 45 × 20 mm, dos transductores cilíndricos metálicos de 16 mm, labios abiertos y rejillas circulares. Los transductores apuntan perpendicularmente al PCB. | Hoja de datos HC-SR04; 45 × 20 × 15 mm para el conjunto habitual.               |
| PIR HC-SR501                   | PCB verde, lente blanca segmentada de 23 mm, soporte de lente, dos ajustes amarillos y circuito en la cara inferior.                                                           | Tarjeta de aproximadamente 32 × 23 mm.                                          |
| LDR GL55                       | Disco cerámico de unos 5 mm con una pista en serpentina sobre la cara frontal.                                                                                                 | Familia GL55, con variantes de diámetro y resistencia.                          |

Las tarjetas vendidas como módulos genéricos pueden variar en color, orden de conectores, tamaño y serigrafía. El modelo del taller no atribuye estos clones a una marca. DFRobot, Waveshare y Keyestudio documentan variantes de referencia de estas familias, no necesariamente la revisión exacta del kit. El color rojo del modelo de nivel corresponde a una variante genérica frecuente; otras placas reales son azules o negras.

## Terminales y montaje

`AnalogSensor({ part, dim, flow, unit })` se inserta dentro del grupo que sitúa el cuerpo en el centro físico de la pieza. Una unidad del plano corresponde al paso de protoboard de **2,54 mm**; `unit` traduce ese paso a coordenadas de la escena (normalmente `0.13`).

La [geometría compartida](../../web/circuit/geometry.ts) conserva el borde del conector junto a la protoboard y hace crecer las sondas largas hacia afuera. `moduleBox` define el PCB y `rainPlateBox` la placa de gotas adicional; `moduleBounds` incluye ambas tarjetas en el encuadre. Las patas de HC-SR04 y LDR entran en los agujeros indicados por el circuito.

Los cuerpos **no duplican** las patas externas ni las etiquetas del circuito. El renderizador común de [CircuitExperience.tsx](../../web/experience/CircuitExperience.tsx) toma los terminales de `endpointXY`, dibuja las conexiones y destaca el mismo extremo que la vista 2D. Así, el modelo visible, el cable, el nombre del pin y el paso guiado comparten la misma posición.

| Pieza            | Terminales del catálogo                                            |
| ---------------- | ------------------------------------------------------------------ |
| Suelo capacitivo | `GND`, `VCC`, `AOUT`                                               |
| Lluvia LM393     | `VCC`, `GND`, `DO`, `AO` (el ejercicio usa `DO`; `AO` queda libre) |
| Nivel de agua    | `S`, `VCC` (marca `+`), `GND` (marca `−`)                          |
| HC-SR04          | `VCC`, `TRIG`, `ECHO`, `GND`                                       |
| PIR HC-SR501     | `VCC`, `OUT`, `GND`                                                |
| LDR              | Dos patas sin polaridad                                            |

El catálogo de terminales y las instrucciones se encuentran en [parts.ts](../../web/circuit/parts.ts) y [layouts.ts](../../web/circuit/layouts.ts). El orden impreso en la pieza real sigue siendo el dato que identifica cada cable; los módulos DHT y PIR tienen variantes con distinto orden de patas.

## Cómo modificar los modelos

1. Actualiza la medida de la familia en `moduleBox` cuando cambie su contorno. Mantén el borde del conector y el paso compartido de los terminales.
2. Modifica el cuerpo correspondiente en `AnalogProximityModels.tsx`, usando `unit / 2.54` para convertir milímetros a coordenadas de Three.js. Los PCB externos usan las dimensiones recibidas de `moduleBox`.
3. Conserva los terminales externos en el renderizador común. Los dos hilos FC-37 ↔ LM393 son internos al conjunto y sí pertenecen al modelo.
4. Si añades un sensor, añade también su definición eléctrica, sus pasos y sus ejemplos de código. Un cuerpo 3D por sí solo no establece compatibilidad del firmware.
5. Revisa la pieza sola, su circuito completo, ambas vistas, el paso pendiente y las dos orientaciones de la protoboard.

Los conjuntos de pistas y rejillas usan `InstancedMesh` para dibujar muchas líneas en una sola llamada. Las geometrías generadas manualmente se liberan al desmontar la pieza. Los textos salen de `BoardText`, que genera y libera una textura local. `dim` conserva la forma y atenúa los colores; `flow` solo ilumina indicadores visuales de la experiencia y no afirma una lectura física del sensor.

## Fuentes consultadas

Consultadas el 14 de octubre de 2026. Los enlaces siguientes respondieron HTTP 200 durante la revisión; no se incluyen copias de sus fotografías en el producto.

- [HC-SR04, hoja de datos alojada por SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf): dimensiones, transductores, señales `Vcc / Trig / Echo / GND`.
- [HC-SR501, guía de Handson Technology](https://www.handsontec.com/dataspecs/SR501%20Motion%20Sensor.pdf): tarjeta 32 × 23 mm, lente de 23 mm, controles de sensibilidad y tiempo.
- [PIR, guía y fotografías de Adafruit](https://learn.adafruit.com/pir-passive-infrared-proximity-motion-sensor/overview): lente segmentada, dos caras, ajustes y componentes inferiores. La variante fotografiada no establece el orden de patas de todos los clones.
- [DFRobot SEN0193, suelo capacitivo](https://wiki.dfrobot.com/Capacitive_Soil_Moisture_Sensor_SKU_SEN0193): placa continua recubierta, dimensiones 3,86 × 0,905 pulgadas y conector de tres señales. Su conector PH2.0 y su silueta puntual pueden diferir del módulo genérico v1.2.
- [FC-37 + LM393, Components101](https://components101.com/sensors/rain-drop-sensor-module): dos tarjetas, pistas interdigitadas, potenciómetro y enlace de dos hilos.
- [Liquid Level Sensor, Waveshare](https://www.waveshare.com/wiki/Liquid_Level_Sensor): tarjeta de 19 × 63 mm, medida analógica y dedos conductores; la variante de referencia es azul.
- [Sensor de agua KS0048, Keyestudio](https://wiki.keyestudio.com/Ks0048_keyestudio_Water_Sensor): variante negra, tres contactos y zona de medida alargada. Se usa para contrastar el aspecto de la familia.
- [LDR, Components101](https://components101.com/resistors/ldr-datasheet): disco, serpentina y dos patas sin polaridad.

Las fotografías de referencia se utilizaron únicamente para comparar proporciones y rasgos durante el desarrollo. Los modelos son procedurales originales y no incorporan logotipos de los fabricantes.
