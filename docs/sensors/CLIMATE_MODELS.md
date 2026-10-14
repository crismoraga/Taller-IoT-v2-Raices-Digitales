# Modelos de sensores de temperatura y humedad

Los modelos de [ClimateModels.tsx](../../web/experience/sensors/ClimateModels.tsx) representan los componentes del taller con geometría local. El DHT11 usa el **CAD KY-015 aportado por el usuario**, convertido al modelo local [ky015.glb](../../public/models/ky015.glb). DS18B20 y LM35 usan modelos originales procedurales. No descargan modelos, imágenes, tipografías ni texturas de terceros en tiempo de ejecución. Las fotografías enlazadas abajo se consultaron para reconocer las piezas; no se incorporaron como assets del sitio.

## CAD KY-015 aportado

El archivo aportado `KY-015.step` se convirtió con [convert-ky015-cad.py](../../scripts/convert-ky015-cad.py), leyendo la topología y los colores de las caras mediante OCP/XDE y CadQuery. La salida conserva los **ocho sólidos reales**, incluida la carcasa ventilada, PCB, componentes, tres cuerpos del header y sus patas; no es una aproximación basada únicamente en sus medidas. Se tesela con tolerancia de 0,12 mm y resolución angular de 0,35 radianes: **11.657 triángulos, ocho materiales y 407.696 bytes** en un único GLB.

Las dimensiones totales nativas son aproximadamente **16 × 27,7 × 8,5 mm**. La conversión pone las patas hacia abajo, centra el eje X en el pin medio y conserva el paso físico de **2,54 mm**. Las puntas de las patas coinciden con la altura y agujeros del montaje, en lugar de dibujar otro header flotante.

La serigrafía blanca del PCB se repinta con el color de la tarjeta porque el CAD tiene un orden impreso fijo. La aplicación dibuja las etiquetas `+`, `S`, `−` sobre las posiciones reales calculadas desde `part.holes`; así sus tres variantes de conexión siguen teniendo una indicación inequívoca. Los colores de la carcasa y los detalles restantes provienen de las caras del CAD.

El GLB contiene únicamente geometría, normales, colores/materiales y nodos genéricos. No se copian encabezados STEP, nombres originales, autores, rutas de trabajo ni otra metadata privada. El archivo STEP original tampoco se publica en el repositorio. Para regenerar el asset, el script requiere CadQuery/OCP/numpy **solo en desarrollo** y recibe explícitamente la ruta del STEP y la ruta de salida.

El navegador carga el GLB desde `/models/ky015.glb` y comparte sus geometrías entre instancias; los materiales atenuados son propios de cada instancia. Mientras carga o si el asset falla, queda disponible el modelo procedural completo con las mismas etiquetas y las tres patas físicas. No se bloquea el circuito ni su interacción por una descarga fallida.

## Componentes y variantes

| Modelo                      | Referencia física                                                                                              | Rasgos visibles                                                                                                                      | Terminales en la aplicación                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| DHT11, módulo de tres patas | Carcasa azul DHT11 sobre PCB; en el montaje las tres patas entran en la protoboard y la tarjeta queda vertical | Rejilla de ventanas cuadradas con nervios cruzados, tarjeta oscura, resistencia de pull-up, bloque del conector y serigrafía `+ S −` | `VCC`, `DATA`, `GND`; se conservan exactamente los agujeros de la lección                  |
| Sonda DS18B20               | Variante encapsulada DFRobot DFR0198, tubo de acero de **35 × 6 mm**                                           | Cápsula continua con punta redondeada, funda negra, transición al cable y tres conductores separados                                 | Rojo `VDD`, amarillo `DATA`, negro `GND`, hasta el terminal concreto de `modulePinXY`      |
| LM35                        | Variante TI **LP / TO-92**, no TO-220 ni TO-CAN                                                                | Encapsulado pequeño con cara plana, espalda curva, inscripción LM35 y tres patas abiertas al paso de la protoboard                   | `vs`, `vout`, `gnd`; la cara plana mira hacia el canal central en el montaje de la lección |

**La foto de un fabricante no determina el orden de las patas del kit.** La ilustración del DHT11 conserva la variante lógica de la lección: `+`, `S`, `−`, correspondientes a `VCC`, `DATA`, `GND`. Otros módulos intercambian ese orden, usan otras marcas o un conector JST. Por eso cada terminal del dibujo está marcado y coincide con `PARTS` y con los agujeros usados por el circuito; el modelo no reordena los pines al cambiar su aspecto.

También existen sondas DS18B20 de 30, 35 o 50 mm y unidades con hilo blanco en lugar de amarillo. El dibujo representa una variante de 35 mm documentada, sin afirmar que todas las sondas tienen la misma longitud o color. El LM35 dibujado corresponde exclusivamente a TO-92; otros encapsulados tienen esquemas distintos.

## Fuentes consultadas

Consultadas el 14 de octubre de 2026, todas accesibles al preparar los modelos:

- [Texas Instruments, LM35, ficha técnica](https://www.ti.com/lit/ds/symlink/lm35.pdf): sección 5, encapsulado LP TO-92 y funciones de los pines; dibujos mecánicos del paquete. La ficha muestra una **vista inferior** en el esquema de pines: no debe confundirse con mirar su cara plana.
- [Analog Devices, DS18B20, ficha técnica](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf): terminales VDD, DQ y GND, bus 1-Wire y encapsulados del chip. No prescribe las medidas de una funda sumergible de terceros.
- [DFRobot DFR0198, sonda DS18B20 sumergible](https://wiki.dfrobot.com/Waterproof_DS18B20_Digital_Temperature_Sensor__SKU_DFR0198_): tubo de acero de 6 mm de diámetro y 35 mm de largo; conductores rojo, negro y amarillo. Sirve de referencia para la sonda modelada.
- [Adafruit 381, sonda DS18B20](https://www.adafruit.com/product/381): segunda referencia visual de la cápsula y la funda; variante de 30 mm y alternativas amarillo/blanco para DATA. Confirma que la geometría y colores varían entre proveedores.
- [Aosong, DHT11, ficha distribuida por Sigma Electrónica](https://www.sigmaelectronica.net/manuals/DHT11.pdf): carcasa, rejilla y sensor desnudo de cuatro patas. No define un pinout único para las tarjetas de tres patas.
- [Components101, DHT11, módulo y sensor desnudo](https://components101.com/sensors/dht11-temperature-sensor): foto de carcasa azul, PCB, componente de pull-up y conector de tres patas. **Su fotografía muestra una variante de orden distinto**; solo se usa como referencia de forma, nunca como sustitución del contrato de la lección.
- [DFRobot DFR0067, DHT11 Gravity](https://wiki.dfrobot.com/DHT11_Temperature_and_Humidity_Sensor__SKU__DFR0067_): referencia adicional de la rejilla y de otra variante de placa, con conector JST.

## Geometría y conexión con el circuito

`unit` es el paso de la protoboard, equivalente a **2,54 mm**. Las dimensiones de los cuerpos se expresan con esa conversión; no se escalan las sondas hasta hacerlas parecer un circuito integrado. La caja de la sonda reserva espacio para el cuerpo y la salida del cable. El LM35 sigue siendo más pequeño que la carcasa DHT11, como las piezas reales.

`ClimateSensor({ part, dim, flow, unit })` se inserta dentro del grupo local que ya usa `SensorBody`. Los componentes independientes aceptan `dim`, `outward`, `unit`, `boardWidth`, `boardDepth` y `pins`. `pins` contiene identificadores y posiciones **locales**, relativas al centro del grupo; no contiene coordenadas globales de la escena.

- Para el DHT11, el CAD y su fallback incluyen sus tres patas; `SensorBody` evita duplicarlas. El LM35 reutiliza las patas que ya dibuja `SensorBody` y sus prolongaciones van hasta el encapsulado. No se añaden pines desconectados de los agujeros.
- Para la sonda, cada conductor termina en la posición de `modulePinXY` y a la altura del terminal de la escena (`0,36` global, `0,18` local con la posición actual del módulo). `SensorBody` no dibuja un falso header metálico para esa sonda.
- `outward` dirige la rejilla DHT11 hacia el exterior de la protoboard. El LM35 presenta su cara plana en sentido contrario, hacia el canal central.
- Las etiquetas usan `BoardText`, que genera sus texturas localmente. Las superficies curvas usan geometrías propias y eliminan sus recursos al desmontarse; los cables usan las curvas de `Tube`.

Al modificar una lección, conserva los identificadores eléctricos de `PARTS`, calcula los terminales con `modulePinXY`/`pointXY` y revisa ambos lados de la protoboard. Cambiar solo la serigrafía o la foto sin cambiar el contrato de conexión puede hacer que la ilustración indique un agujero distinto del realmente conectado.
