# Placas compatibles

Esta tabla describe los perfiles que el código implementa. **Compatibilidad USB** significa transporte por Web Serial en Chrome/Edge seguro y con consentimiento del usuario. **Compilación probada** comprueba el toolchain y el binario; **carga simulada** prueba el protocolo con un peer/bootloader de prueba. Ninguno de esos estados sustituye conectar y probar una unidad física del taller.

| Placa seleccionada | Ejecución y carga | Conectividad de datos | Variantes verificadas en software | Límites |
| --- | --- | --- | --- | --- |
| Raspberry Pi Pico | MicroPython por USB; UF2 MicroPython específico `RPI_PICO` | USB hacia navegador y API | Parser/modelo MicroPython y mapa RP2 compartido | Sin Wi-Fi integrado; no usar UF2 W. |
| Raspberry Pi Pico W | MicroPython por USB; UF2 `RPI_PICO_W` | USB o Wi-Fi 2.4 GHz opcional | Instalación y flujo Web Serial; W habilita Wi-Fi | La conectividad remota requiere SSID, endpoint HTTPS y CA compatibles. |
| Raspberry Pi Pico 2 | MicroPython por USB; UF2 `RPI_PICO2` | USB hacia navegador y API | Modelo RP2, contenido y selección exacta de UF2 | Sin Wi-Fi integrado; prueba física depende de la unidad disponible. |
| Raspberry Pi Pico 2 W | MicroPython por USB; UF2 `RPI_PICO2_W` | USB o Wi-Fi 2.4 GHz opcional | Selección exacta de modelo/UF2 y flujo Wi-Fi desde UI | La compatibilidad del firmware depende de la versión oficial instalada y del ensayo en placa real. |
| Arduino Uno ATmega328P | Arduino AVR, FQBN `arduino:avr:uno`; STK500v1 | USB por navegador; puente USB de telemetría | Compilación real de ejemplos/estación y peer de carga a 115200/57600 con los tiempos de arranque medidos en un Uno. Carga física comprobada en un Uno original (ATmega328P + 16U2, Optiboot a 115200) ejecutando el cargador sobre un adaptador de Web Serial en Node | El bootloader, cable, reset y driver del dispositivo real deben responder. La carga desde el navegador se comprobó a mano en ese mismo Uno; los clones siguen pendientes de ensayo. |
| Arduino Nano ATmega328P | `arduino:avr:nano:cpu=atmega328`; STK500v1 | USB por navegador | Compilación y firma de MCU | Seleccionar Nano con bootloader antiguo si el perfil moderno no sincroniza. |
| Arduino Nano ATmega328P · bootloader antiguo | `arduino:avr:nano:cpu=atmega328old`; STK500v1 | USB por navegador | Compilación con velocidad heredada | 57600 se intenta antes que 115200; clones pueden variar. |
| Arduino Nano ATmega168 | `arduino:avr:nano:cpu=atmega168`; firma `1E 94 06`, 19200 baud | USB por navegador | Compilación real de catálogo/estación y peer de carga con verificación de páginas | Flash/RAM son menores; no sustituir automáticamente por ATmega328P. |
| Raspberry Pi 3 / 4 con Raspberry Pi OS | Computador Linux anfitrión; Chromium + Arduino USB. Comprobador Python local para GPIO; no se flashea desde Web Serial | USB de Arduino hacia navegador o puente Python autorizado; pruebas GPIO imprimen JSON local | Parser USB, permisos de credencial, reconexión, cola acotada y drivers GPIO con peers de prueba | No tiene ADC nativo. Suelo/LDR/nivel necesitan un ADC externo, como MCP3008, o Arduino. No se ensayó hardware Pi físico en esta revisión. |

### Compatibilidad de pines de la familia Pico

Pico, Pico W, Pico 2 y Pico 2 W comparten el formato de 40 contactos y el perfil RP2 que utiliza el circuito del taller. Las actividades usan GP y pin físico explícitos. La conectividad Wi-Fi solo está disponible en modelos W. La elección del modelo determina el UF2; nunca deducimos `W` solamente del identificador USB.

### Placas que se reconocen pero no se deben flashear con estos perfiles

Entre otras, Arduino Mega, Leonardo/Micro, Due, Zero, Uno R4, Nano Every, placas ESP32 y Raspberry Pi con Linux tienen distinto MCU, pinout, bootloader o protocolo. No se les compila ni carga el perfil AVR/Pico del taller. Raspberry Pi 3/4 dispone de su herramienta Linux independiente en Ajustes; permanece fuera del selector de microcontroladores para que la compilación y el mapa de Arduino conserven su significado. Un microcontrolador compatible montado en un clon puede tener bootloader, reloj, regulador o puente serial diferente: la firma y el funcionamiento real son lo que determina la carga.

### Raspberry Pi 3 / 4: comprobación acotada de sensores

En Ajustes → «Raspberry Pi 3 / 4 · comprobar sensores» se descarga `check_sensors.py`. Se ejecuta en Raspberry Pi OS, imprime lecturas JSON y devuelve estados explícitos cuando falta una biblioteca, una respuesta o el ADC. Permite DHT11, DS18B20, HC-SR04, HC-SR501 y FC-37+LM393. Suelo, LDR y nivel de agua son opcionales mediante MCP3008 por SPI; el conversor no identifica automáticamente la presencia física de una sonda. Los pines BCM y físicos aparecen para un sensor a la vez.

El puente opcional [`firmware/raspberry-pi/bridge.py`](../firmware/raspberry-pi/bridge.py) transporta la estación Arduino USB a `/api/device/ingest` sin dejar un navegador abierto. Vincula con un código de un uso, conserva la credencial únicamente en un archivo local `0600`, usa HTTPS verificado y no sigue redirecciones con el token. El buffer serial tiene límite, cada reconexión descarta datos anteriores y las interrupciones de red conservan solo la lectura más reciente por ocho segundos. No sube programas ni transforma diagnósticos fallidos en medidas válidas.

## Perfiles AVR implementados

| Perfil | FQBN | Firma esperada | Velocidades STK500v1 | Flash utilizable | SRAM |
| --- | --- | --- | --- | ---: | ---: |
| Uno 328P | `arduino:avr:uno` | `1E 95 0F` | 115200, 57600 | 32256 B | 2048 B |
| Nano 328P | `arduino:avr:nano:cpu=atmega328` | `1E 95 0F` | 115200, 57600 | 30720 B | 2048 B |
| Nano 328P antiguo | `arduino:avr:nano:cpu=atmega328old` | `1E 95 0F` | 57600, 115200 | 30720 B | 2048 B |
| Nano 168 | `arduino:avr:nano:cpu=atmega168` | `1E 94 06` | 19200 | 14336 B | 1024 B |

Los valores se centralizan en [`shared/boards.ts`](../shared/boards.ts). La API y el compilador validan el perfil; el cargador lee firma y memoria. Si no coincide el MCU, el firmware no se escribe. No se cambia de MCU de forma automática.

## Qué comprobar al añadir un perfil

Consulta [Desarrollo](DEVELOPMENT.md#incorporar-una-placa). Como mínimo documenta fabricante/modelo, MCU, bootloader/protocolo, firma, velocidad, FQBN, flash/RAM, pinout, firmware base, conectividad y sensores soportados. Añade prueba para respuesta correcta, timeout, desconexión, firma errónea antes de escritura, lectura de memoria y selección del modelo al cambiar la placa. Señala por separado qué se validó con compilador, peer virtual y hardware físico.
