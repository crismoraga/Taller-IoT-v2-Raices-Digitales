# Raíces Digitales: hardware y cableado

Este mapa es el contrato físico de la estación. Los números **GP** son GPIO; los números físicos son la posición en los 40 contactos de Pico W, con USB arriba. Arduino Uno/Nano AVR de 5 V utiliza el mapa alternativo de la tabla; no incluye Wi-Fi y envía datos mediante el navegador por USB. No aplicar este mapa a Arduino Due, Zero u otras placas de 3.3 V.

## Inventario real

Diez grupos usan diez kits MCI y diez unidades de cada modelo comprado. Las dos unidades restantes de cada uno de los siete modelos son repuestos, no material para aumentar las capacidades de una estación.

Cada kit incluye Pico W, protoboard 830 puntos, USB Micro-B, jumpers/ribbon, LED rojo/amarillo/azul, **5×220 Ω, 5×1 kΩ y 5×10 kΩ**, buzzers, pulsadores, fotoresistores 5549, LM35, SW520D, potenciómetro, sensor de llama, receptor/control IR, 74HC595, displays, LCD 16×2, matriz LED, servo SG90, motor paso a paso, ULN2003, headers, PCB y organizador. Los siete sensores comprados son sonda capacitiva v1.2, DS18B20, DHT11, FC-37+LM393, Water Level Sensor, HC-SR04 y HC-SR501. No se presupone ESP32, relé, bomba, shield Wi-Fi, LCD I2C, sensor de pH ni fuente adicional.

La Pico W sin sufijo H puede venir sin headers soldados. El docente debe montar los headers antes del taller: no es una actividad de soldadura para estudiantes dentro de la hora.

## Pines de estación

| Dispositivo / terminal | Pico W | Pin físico | Uno/Nano AVR | Alimentación Pico |
|---|---|---:|---|---|
| Sonda suelo / AOUT | GP26 / ADC0 | 31 | A0 | 3V3 |
| LDR / nodo divisor | GP27 / ADC1 | 32 | A1 | 3V3 |
| Water Level / S | GP28 / ADC2 | 34 | A2 | 3V3 |
| FC-37 módulo / DO | GP14 | 19 | D6 | 3V3 |
| DHT11 / DATA | GP15 | 20 | D4 | 3V3, confirmar variante |
| DS18B20 / DATA | GP16 | 21 | D5 | 3V3 |
| HC-SR04 / TRIG | GP17 | 22 | D7 | VBUS / 5 V |
| HC-SR04 / ECHO, nodo adaptado | GP18 | 24 | D8 | ECHO 5 V requiere divisor en Pico |
| HC-SR501 / OUT | GP19 | 25 | D9 | VBUS / 5 V |
| LED externo con 220 Ω | GP2 | 4 | D2 | GPIO |
| Piezo pasivo de baja corriente, 220 Ω serie | GP3 | 5 | D3 | GPIO, confirmar piezo |
| Pulsador, actividad individual | GP4 | 6 | D4 | Pull-up interno y contacto a GND |
| LM35, actividad individual | GP26 / ADC0 | 31 | A0 | VBUS / 5 V |
| Potenciómetro, actividad individual | GP26 / ADC0 | 31 | A0 | Extremos 3V3 y GND |

Pico: **3V3 = pin 36**, **VBUS = pin 40**, **GND = pin 38** o cualquiera de 3, 8, 13, 18, 23, 28. Pin 33 AGND también es masa analógica. VBUS proporciona el voltaje USB; no confundir con VSYS, RUN ni 3V3_EN. Todos los sensores comparten GND. El riel 5 V de HC-SR04/PIR está separado del riel 3V3 de las señales.

La Pico expone solamente tres entradas ADC de uso externo. LM35 y potenciómetro se prueban retirando primero la sonda suelo de GP26; no se montan como sensores adicionales simultáneos de la estación final.

## Protoboard

Cada fila de cinco contactos está unida por dentro; el canal central separa los dos bloques. Los rieles laterales de alimentación pueden estar divididos en el centro: une ambas mitades con un jumper cuando sea necesario. Los colores del dibujo son una guía de alimentación, no prueba de continuidad. Ubica la placa cruzando el canal sin unir pines vecinos. Desconecta USB antes de recablear; que dos contactos parezcan separados no significa que estén aislados.

La escena 3D es una referencia de ubicación y etiquetas. La vista 2D, el texto del paso y esta tabla determinan la conexión eléctrica; la forma exacta de los módulos comprados puede variar.

## HC-SR04: protección de ECHO con el kit

La versión HC-SR04 habitual trabaja a 5 V y ECHO puede alcanzar 5 V. Pico GPIO no tolera esa señal directa. El divisor consume las **cinco resistencias de 1 kΩ** del kit:

```text
HC-SR04 ECHO ── 1 kΩ ── 1 kΩ ──┬── GP18 (pin 24)
                               │
                              1 kΩ
                               │
                              1 kΩ
                               │
                              1 kΩ
                               │
                              GND
```

Arriba hay 2 kΩ en serie; abajo, 3 kΩ en serie. Para 5 V nominales: `Vsalida = 5 × 3/(2+3) = 3.0 V`. Se deja margen respecto de 3.3 V. Con resistores ±5 %, el extremo de proporciones da aproximadamente 3.12 V con entrada 5 V; el docente debe comprobar el USB y componentes concretos antes del primer uso. La propuesta original 1 kΩ arriba / 2 kΩ abajo produce 3.33 V nominales y no se usa.

VCC a VBUS, GND a GND, TRIG a GP17. Mantén cables cortos. En Uno/Nano AVR de 5 V, ECHO puede ir directamente a D8; omitir el divisor si la lectura 3 V queda en el límite de nivel alto. Las versiones HC-SR04 de 3.3 V tienen fichas distintas: no asumir que la unidad comprada es una de ellas.

Un timeout significa **sin eco válido**, que también ocurre con una superficie inclinada, absorbente, cercana o lejana. No permite afirmar con certeza que el sensor está desconectado.

## DS18B20: bus 1-Wire

Alimentación de tres hilos: VDD a 3V3, GND a masa y DATA a GP16. No se usa alimentación parásita. Colores habituales rojo/negro/amarillo no constituyen una garantía: confirmar etiqueta del proveedor antes de dar energía.

Dos resistencias de 10 kΩ **en paralelo** entre DATA y 3V3 proporcionan 5 kΩ, aproximación al pull-up recomendado de 4.7 kΩ para el cable corto de laboratorio. Ambos extremos de las dos resistencias deben coincidir; en serie serían 20 kΩ. Comprobar respuesta en las diez unidades reales. Después de ordenar conversión, espera 750 ms para 12 bits; no tratar 85 °C recién encendido como una medición válida.

## DHT11: sensor desnudo frente a módulo

El nombre comercial no determina el orden de sus pines ni la alimentación mínima. La ficha Aosong citada admite 3–5.5 V, pero variantes/comercializaciones indican mínimos superiores. Antes del taller, confirma que la unidad funciona dentro de especificación a 3.3 V. No solucionar una falla cambiando a 5 V y conservando un pull-up de DATA a 5 V conectado a Pico.

Un DHT11 desnudo de cuatro patas, rejilla hacia ti, suele ser 1 VCC, 2 DATA, 3 NC y 4 GND; confirmar ficha. DATA a GP15 y resistor **10 kΩ entre DATA y 3V3**. Un módulo de tres patas puede incluir ese resistor: seguir serigrafía del módulo y no asumir el orden del sensor desnudo. Si la variante adquirida exige 5 V y no se ha validado una adaptación de señal segura, usa DS18B20 en el recorrido central y deja DHT11 deshabilitado en Pico; Uno/Nano puede alimentarlo a 5 V. No se presupone un conversor de niveles ausente del kit.

En el ejemplo individual Arduino que usa `DHT.h`, la biblioteca puede activar un pull-up interno y conducir DATA a 5 V: **alimenta el DHT11 a 5 V y usa pull-up a 5 V** si su ficha lo admite. No alimentes ese sensor a 3.3 V mientras sus señales están a 5 V. El firmware Arduino integrado implementa un bus con salida baja/alta impedancia y pull-up externo para evitar esa mezcla; consulta su guía y conserva el montaje seleccionado. Ninguno de esos pines Arduino se conecta directamente a la Pico.

Espera dos segundos entre muestras y no mojes el DHT. El checksum/timeout permite detectar fallo de protocolo, no garantiza exactitud ni permite distinguir todas las causas del fallo.

## Sensores analógicos y comparadores

- **Suelo v1.2:** 3V3, GND, AOUT a GP26. Las copias pueden diferir; prueba las unidades adquiridas a 3.3 V antes del taller. Mantén seca toda la electrónica superior y el conector. El porcentaje de dos referencias es relativo; no es humedad volumétrica.
- **LDR 5549:** `3V3 → LDR → nodo GP27 → 10 kΩ → GND`. Más luz normalmente aumenta raw en este montaje. No representa lux. Evita invertir la ubicación de LDR/resistencia si vas a conservar las referencias existentes.
- **Nivel agua:** + a 3V3, − a GND, S a GP28. Solo se mojan las pistas. Corrosión y conductividad cambian la respuesta; desenchufa y seca al terminar. No describe centímetros sin una geometría y calibración específicas.
- **FC-37:** placa de dos hilos a su LM393; LM393 a 3V3 y masa, DO a GP14. El código usa activo bajo habitual (`mojado = 1 − DO`); verifica la polaridad de tu módulo y ajusta el trimmer con una gota controlada. No mide intensidad de lluvia.
- **PIR HC-SR501:** VCC a VBUS 5 V, GND común y OUT a GP19. La salida habitual es 3.3 V; confirmar unidad antes de usar Pico. Espera unos 60 s para estabilizar y recuerda que detecta cambios infrarrojos, no personas quietas.
- **LM35:** la ficha exige 4–30 V; usa VBUS 5 V, no 3V3. VOUT a GP26 después de retirar la sonda. Conversión `°C ≈ voltios × 100`. Confirma encapsulado/pinout y referencia ADC. Solo uso individual.

## Presupuesto de resistencias para la estación completa

| Uso | Resistencias |
|---|---|
| HC-SR04, divisor | 5×1 kΩ: se usa toda la existencia de ese valor |
| DS18B20, pull-up | 2×10 kΩ en paralelo |
| LDR, divisor | 1×10 kΩ |
| DHT11 desnudo | 1×10 kΩ |
| LED | 1×220 Ω |
| Piezo pasivo opcional | 1×220 Ω |

Queda una resistencia 10 kΩ con DHT desnudo. Las lecciones opcionales reutilizan componentes de la estación; no se realizan todas simultáneamente. No se agrega una bomba. Los siguientes ejemplos se incluyen como actividades individuales fuera de la hora central:

| Componente disponible | Driver real incluido y conexión segura |
|---|---|
| Pulsador / SW520D | Entrada GPIO con pull-up, contacto a GND |
| Potenciómetro / LM35 | ADC retirando antes la sonda suelo; LM35 a 5 V |
| Piezo pasivo | PWM con 220 Ω solo piezo de baja corriente apto para GPIO |
| Buzzer activo | Pulsos mediante ULN2003, tensión de carga confirmada |
| 74HC595 | Shift/latch software, VCC3V3 Pico / VCC5V Arduino, LED limitado |
| Sensor de llama | DO de comparador a 3.3 V; estímulo óptico sin fuego |
| Receptor IR / mando | Decodificador NEC, tensión y pinout del receptor verificados |
| LCD 16×2 | Bus paralelo4bits; RW a GND permanente, nunca lectura de5V sobre Pico; verificar VIH del controlador |
| Display7segmentos | 1×1 kΩ en común, **solo un segmento por instante** |
| Display4dígitos | 4×1 kΩ, una por común; **solo una pareja dígito/segmento por instante** |
| Matriz8×8 desnuda | 5×1 kΩ +3×10 kΩ en filas; **un LED por instante**, sin MAX7219 |
| Motor paso a paso5V | Driver ULN2003, una bobina activa, corriente/budget USB verificados antes |
| SG90 | Pulsos50Hz con tiempos acotados; señal demostrada en LED+1 kΩ. **No se energiza el motor con fuente no validada** |

Los display/matriz no tienen un pinout universal. El docente identifica el código del encapsulado, filas/columnas, comunes y polaridad antes de comenzar. Los ejemplos contienen una opción de polaridad; no requieren un módulo de display comprado aparte. La resistencia compartida en7segmentos solo es segura con un LED activo por instante; no se reutiliza ese esquema para encender todos a la vez.

La LCD se alimenta a5V, con potenciómetro de contraste entre5V/GND y cursor aV0. En Pico solo se usa si el modelo HD44780-compatible confirma VIH compatible con3.3V; RW permanece aGND y D0–D3 no se conectan. La resistencia220Ω de backlight se conserva. No asumir que LCD16×2 lleva un adaptador I2C.

El motor unipolar del kit usa el ULN2003 disponible, con sus diodos COM a5V y tierra común. El código desactiva Wi-Fi, energiza una sola bobina y libera el motor al finalizar. El docente comprueba corriente de la bobina, orden y corriente disponible: ser motor5V no determina su consumo. El código no promete un ángulo universal de giro.

Para SG90, el fabricante TowerPro declara alimentación mediante adaptador externo y reporta corrientes de0.5–2A para su versión. USB de un computador y el riel Pico no garantizan esa potencia; el soporte9V no es una fuente regulada4.8–6V. Por tanto, el taller con el inventario actual muestra la **señal PWM real en LED** y entrega el driver completo, pero el movimiento físico del servo queda fuera del taller base hasta disponer de alimentación validada. No se afirma haber comprado esa fuente ni se simula un eje girando.

## Diagnóstico honesto

| Sensor | Se puede comprobar | No se puede inferir con certeza |
|---|---|---|
| DS18B20 | ROM encontrada, conversión, CRC | Exactitud absoluta sin referencia |
| DHT11 | Mensaje válido o timeout/checksum | Cable roto frente a sensor defectuoso en todos los casos |
| HC-SR04 | Eco y rango temporal | Ausencia del sensor frente a falta de reflector |
| ADC suelo/luz/nivel | Rango eléctrico y consistencia | Presencia de sensor: un ADC flotante también tiene números |
| FC-37/PIR | Nivel alto o bajo | Presencia física o estado correcto solo por nivel estable |

`UNVERIFIED` solicita una prueba física de respuesta; no transforma un dato en simulación. `DISABLED` es una decisión explícita. Un valor nulo acompañado de `NO_RESPONSE` no se reemplaza por una lectura inventada ni por la última lectura como si fuera nueva.

## Fuentes técnicas consultadas

- [Raspberry Pi Pico W Datasheet y pinout](https://datasheets.raspberrypi.com/picow/pico-w-datasheet.pdf): contactos, alimentación y funciones de placa.
- [MicroPython RP2 quick reference](https://docs.micropython.org/en/latest/rp2/quickref.html): ADC, GPIO, PWM, USB REPL y 1-Wire; consultar versión estable instalada en la placa.
- [Analog Devices DS18B20 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf): alimentación, pull-up, conversión y protocolo.
- [Aosong DHT11 datasheet distribuido por Sigma Electrónica](https://www.sigmaelectronica.net/manuals/DHT11.pdf): niveles, comunicación y variantes; confirmar ficha de la unidad adquirida.
- [HC-SR04 5 V datasheet de fabricante distribuido por SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf): pinout, pulso y alimentación.
- [Texas Instruments LM35](https://www.ti.com/product/LM35): alimentación mínima de 4 V y 10 mV/°C.
- [DFRobot sensor capacitivo SEN0193](https://wiki.dfrobot.com/sen0193/): referencia del principio y calibración; **no es una certificación de las copias v1.2 compradas**.
- [MDN Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API): disponibilidad y contexto seguro para USB desde navegador.
- [Texas Instruments ULN2003A](https://www.ti.com.cn/lit/gpn/ULN2003AI): driver de cargas y diodos de protección; comprobar corriente y disipación del montaje.
- [Texas Instruments SN74HC595](https://www.ti.com/product/SN74HC595): alimentación y límites de entrada/salida del registro.
- [Hitachi HD44780U datasheet distribuido por SparkFun](https://www.sparkfun.com/datasheets/LCD/HD44780.pdf): bus paralelo y niveles del controlador original; confirmar el controlador del módulo adquirido.
- [TowerPro SG90](https://towerpro.com.tw/product/sg90-7/): alimentación externa y límites del servo; las variantes/copies requieren su propia verificación.

Las pruebas de código con pines simulados no son una validación eléctrica de las unidades compradas. Para aprobar un taller real, el docente verifica diez conjuntos físicos, cada modelo exacto y una red del aula antes de recibir estudiantes.
