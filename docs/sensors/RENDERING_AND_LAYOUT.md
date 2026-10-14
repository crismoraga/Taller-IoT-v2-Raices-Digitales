# Geometría, variantes y montaje de sensores

Las vistas 2D y 3D comparten el mismo circuito declarativo. Un paso de dibujo equivale a **2,54 mm**: las patas insertadas usan `part.holes`; los módulos externos usan `moduleBox`, `modulePinXY` y `endpointXY` de `web/circuit/geometry.ts`. Cambiar una silueta no cambia sus conexiones eléctricas.

| Pieza representada | Silueta aproximada                              | Modelo                                                                            |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Sonda capacitiva   | 98 × 23 mm                                      | Placa estrecha, punta redondeada, electrónica junto al conector; cobre recubierto |
| Nivel de agua      | 63 × 19 mm                                      | Dos electrodos con pistas intercaladas                                            |
| PIR HC-SR501       | 32 × 23 mm                                      | PCB y cúpula Fresnel                                                              |
| Lluvia             | LM393 de 32 × 14 mm y placa FC-37 de 50 × 40 mm | Dos cuerpos unidos por dos hilos                                                  |
| DS18B20            | Cápsula DFRobot de 35 × 6 mm                    | Cápsula, funda y tres hilos propios                                               |
| DHT11              | Módulo de tres patas                            | PCB vertical, rejilla y marcas de terminales                                      |
| HC-SR04            | PCB de 45 × 20 mm                               | Dos transductores de 16 mm mirando hacia afuera                                   |

Son variantes de referencia, con tamaños redondeados al sistema de dibujo. Las fuentes y diferencias entre fabricantes se detallan en [CLIMATE_MODELS.md](CLIMATE_MODELS.md) y [ANALOG_PROXIMITY_MODELS.md](ANALOG_PROXIMITY_MODELS.md). La fila exterior de conectores se centra en la PCB y conserva un paso de 2,54 mm. `moduleBounds` incluye accesorios, como la placa separada de lluvia, para que el encuadre no los recorte.

## Añadir o modificar un modelo

1. Definir terminales y orientación en `web/circuit/parts.ts`, conservando los identificadores eléctricos.
2. Definir `part.holes` o la posición externa en el circuito; no duplicar coordenadas de cables dentro del modelo.
3. Implementar el cuerpo en `web/experience/sensors/`. `SensorBody` posiciona el grupo y comparte las patas, conectores, marcadores y etiquetas. El DS18B20 dibuja sus propios hilos, terminados en `modulePinXY`.
4. Actualizar la silueta SVG en `web/circuit/ModuleShapes.tsx` y los límites de encuadre si cambian medidas o accesorios.
5. Verificar netlist, holgura física y `tests/moduleGeometry.test.ts`. La prueba de encuadre proyecta todos los extremos a distintos formatos de pantalla.

Los modelos reciben `{ part, dim, flow, unit }`. La selección de una pieza abre su ficha; **Ver pieza de cerca** calcula un encuadre de ese cuerpo y sus terminales usando `partSceneBounds` y `fittedCameraDistance`. La animación de recorrido es una explicación visual; las mediciones llegan por el flujo USB de la aplicación.

## DHT11 con otro orden de terminales

En **Conecta → Mi DHT11 tiene otras marcas**, se puede elegir `+ / S / −`, `S / + / −` o `− / S / +`, mirando la rejilla de frente. Las equivalencias son `+ = VCC`, `S = DATA` y `− = GND`.

`configureDhtPinOrder` adapta únicamente las tres patas del DHT11 y sus tiras del mismo lado de la protoboard. Mantiene el resto de componentes, los rieles y el lado contrario; el netlist esperado conserva los mismos terminales. Los textos, la escena 3D y el plano 2D derivan de esa configuración. `dhtLayout.ts` comparte la preferencia entre **Entiende** y **Conecta** y sincroniza otras pestañas abiertas.

El orden original sigue siendo el predeterminado. Cada variante tiene una clave de avance propia y una firma de circuito distinta, para reanudar las conexiones de esa variante sin aprobar instrucciones de otra.
