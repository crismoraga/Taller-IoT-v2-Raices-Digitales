# Firmware y USB reales

La estación principal utiliza Pico W con el firmware oficial MicroPython para **RPI_PICO_W**, no Pico sin Wi-Fi. El navegador abre su USB mediante Web Serial. No hay intérprete de Python local ni emulación: el código se transmite a la placa, allí se ejecuta y su salida vuelve a la terminal. Chrome/Edge de escritorio necesitan HTTPS o localhost y un cable USB de datos. El usuario selecciona el puerto al conectar. Cierra Thonny, Arduino IDE y otras pestañas que lo tengan abierto.

## Instalación de Pico W

1. Mantén BOOTSEL al conectar USB. Copia el UF2 oficial de [MicroPython para Pico W](https://micropython.org/download/RPI_PICO_W/) al volumen RPI-RP2. Al reiniciar deja de ser un disco y aparece como puerto serial. BOOTSEL solo es necesario para instalar MicroPython.
2. Abre Raíces Digitales, entra a tu grupo y selecciona Pico W. Conecta USB.
3. En configuración activa solamente sensores realmente cableados. Calibra suelo/nivel antes de pedir porcentajes.
4. En Conectar ingresa la red Wi-Fi **2.4 GHz** y el endpoint HTTPS completo, por ejemplo `https://taller.example.org/api/device/ingest`. Usa un servidor accesible desde esa red; `localhost` en la Pico sería la propia Pico. No admite portales cautivos ni WPA Enterprise.
5. Instala la estación. El navegador obtiene una credencial propia del grupo, guarda todos los módulos y genera `config.json` directamente en tu placa. La contraseña Wi-Fi y token nunca están en el repositorio ni en el bundle descargable. Se almacenan en claro en la memoria física de la Pico: no prestes una placa configurada con credenciales privadas.
6. La instalación inicia `main.py`. También arranca al reiniciar la placa. Al terminar el taller revoca la estación desde la plataforma y borra `config.json` si vas a compartirla.

`config.example.json` documenta el formato y lleva credenciales vacías. `config.json` admite `ssid`, `password`, `endpoint`, `deviceId`, `token`, `enabled`, `calibration`, `rtc` y `caFile`. Por compatibilidad también acepta `sensorEnabled` y `calibrations`. `rtc` es `[año,mes,día,hora,minuto,segundo]` **UTC**, tomado del reloj del navegador al instalar. Los nombres de sensores coinciden con el contrato API; DHT11 se habilita con `dht11` o `air_temperature`/`air_humidity`. Sin mapa de habilitación todos los sensores quedan desactivados.

## Drivers de la estación

| Driver | Pico W GPIO | Pin físico | Uno/Nano | Lectura |
|---|---:|---:|---|---|
| Sonda suelo capacitiva v1.2 | GP26 / ADC0 | 31 | A0 | Porcentaje relativo + ADC crudo |
| LDR 5549 con divisor | GP27 / ADC1 | 32 | A1 | Luz relativa, no lux |
| Water Level Sensor | GP28 / ADC2 | 34 | A2 | Porcentaje relativo + ADC crudo |
| FC-37 + LM393 DO | GP14 | 19 | D6 | Activo en bajo; 1 = gotas |
| DHT11 | GP15 | 20 | D4 | `air_temperature`, `air_humidity` |
| DS18B20 | GP16 | 21 | D5 | `soil_temperature`, ROM + CRC |
| HC-SR04 | TRIG GP17, ECHO GP18 | 22, 24 | D7, D8 | Tiempo de eco; límite 30 ms |
| HC-SR501 | GP19 | 25 | D9 | PIR; espera 60 s de estabilización |
| LED / buzzer | GP2 / GP3 | 4 / 5 | D2 / D3 | Actuadores para actividades |

Pico admite entradas de **3.3 V**, nunca 5 V. HC-SR04 requiere 5 V de alimentación y divisor en ECHO: dos resistencias de 1 kΩ en serie entre ECHO y nodo, tres de 1 kΩ en serie del nodo a GND; el nodo entrega aproximadamente 3 V. Arduino Uno/Nano de 5 V admite ECHO directo. DS18B20 necesita pull-up: dos resistencias de 10 kΩ en paralelo = 5 kΩ entre DATA y 3V3. No requiere comprar 4.7 kΩ. LDR usa 10 kΩ del nodo a GND y LDR del nodo a 3V3. DHT11 desnudo necesita un pull-up adicional de 10 kΩ; confirma que la variante comprada admita 3.3 V antes de conectar a Pico. Mantén electrónica y conectores secos.

La sonda de suelo, nivel y LDR usan mediana de nueve muestras. Suelo/nivel no producen un porcentaje hasta recibir extremos físicos separados por al menos 500 cuentas ADC en Pico o 8 en AVR. Fórmula `100 × (raw − seco) / (húmedo − seco)`, válida en ambos sentidos de voltaje. ADC Pico: 0–65535; Uno/Nano: 0–1023. No transportes calibraciones entre estas placas. Una señal pegada al riel es `UNVERIFIED`, no una afirmación de sensor desconectado. Valores muy alejados del rango de calibración son `OUT_OF_RANGE`. Cada driver tiene manejo de error independiente: fallo DHT/DS/eco no cancela las otras lecturas.

Un ADC o GPIO sencillo no identifica presencia. LDR/suelo/nivel calibrados son estimaciones; lluvia y PIR conservan `UNVERIFIED` porque un cero puede representar reposo o cable ausente. DS18B20 descubre ROM en cada lectura, espera 800 ms y comprueba CRC; DHT espera respuesta/checksum; HC-SR04 limita la espera de eco y reporta `NO_RESPONSE` sin atribuir una causa única. Los 85 °C de DS18B20 se marcan inciertos porque pueden ser su valor de arranque. PIR no detecta personas inmóviles.

## Red y autenticación

`main.py` produce líneas JSON con `{readings:[...],diagnostics:{...}}` por USB aproximadamente cada dos segundos. Envía el último lote por HTTPS como máximo cada cinco segundos con `Authorization: Bearer <token>` y `source: hardware`. Cuando falla la red continúa midiendo localmente y reintenta: Wi-Fi emplea backoff de 1 a 60 segundos; envío fallido espera 15 segundos. No conserva una cola histórica en flash ni inventa datos durante una caída.

TLS usa `SSLContext(PROTOCOL_TLS_CLIENT)`, `CERT_REQUIRED`, CA real y `server_hostname`. Se incluye **ISRG Root X1** descargada de [Let's Encrypt](https://letsencrypt.org/certificates/), convertida de PEM a DER al cargar para compatibilidad con MicroPython. Funciona con una cadena válida hacia esa raíz. Si tu servidor utiliza otra CA, instala su certificado de confianza y cambia `caFile`; una cadena no confiable falla cerrada. No se desactiva verificación para que un ejemplo funcione. Es necesario que la versión instalada de MicroPython admita `SSLContext` y `CERT_REQUIRED`; compruébalo en REPL si el envío falla.

La fecha UTC inicial viene del navegador. Hay una consulta NTP de respaldo con timeout UDP de dos segundos. Antes de otro taller actualiza la configuración para que la fecha guardada sea vigente: Pico W no tiene batería de RTC y un corte de alimentación pierde su reloj. Socket HTTPS usa timeout de tres segundos, límite de envío/respuesta y una sola línea HTTP de hasta 256 bytes. DNS del stack nativo de MicroPython puede tardar más que un timeout de socket; la cadencia de dos segundos puede retrasarse durante DNS/TLS o un servidor lento. No es un sistema de tiempo real duro. Las medidas USB siguen disponibles sin Wi-Fi; en red local el navegador también puede actuar como puente de ingestión, si permanece abierto.

## Protocolo MicroPython en el navegador

`web/lib/serial.ts` implementa raw REPL real y raw-paste con negociación de ventana de flujo. Si el firmware no soporta raw-paste usa bloques de 256 bytes con pausas. No inserta código en el REPL amigable con autoindentado.

- `serial.run(code)` confirma recepción del programa y sigue transmitiendo salida indefinidamente; un bucle infinito no bloquea la interfaz.
- `serial.exec(code)` espera terminación, separa stdout/stderr y rechaza errores de la placa. Límite de ejecución de 15 segundos. La captura de calibración usa esta operación finita.
- `serial.stop()` envía Ctrl+C dos veces y devuelve REPL amigable. Interrumpe un bucle mientras espera salida.
- `serial.saveFile(path, content)` codifica UTF-8 a bytes escapados, escribe bloques de 512 bytes en un temporal y renombra al terminar. Rechaza rutas absolutas y `..`.
- `serial.install(files)` instala módulos y `main.py` al final. No reinicia por sorpresa; la UI inicia el programa después de escribir todos los archivos.
- `disconnect()` cancela la lectura, libera ambos locks y cierra el puerto. Un evento de desconexión física actualiza la UI.

El código editable se ejecuta con los permisos físicos normales de MicroPython en la placa del grupo. Una reinstalación interrumpida puede conservar módulos de distintas versiones; vuelve a instalar el bundle entero antes de usarla. Los ficheros individuales se reemplazan mediante temporal, no hay una transacción de todo el sistema de archivos.

## Arduino real

Uno/Nano clásicos ATmega328P están soportados por STK500v1, con bootloader `uno`/`nano` a 115200 baudios y `nano-old` a 57600. El monitor de los ejemplos trabaja a 115200: para Nano antiguo el transporte cambia a 57600 durante la carga y vuelve a 115200 al terminar, usando el mismo permiso USB. El backend compila C++ con Arduino CLI y devuelve Intel HEX. El navegador valida checksums, EOF, direcciones y solapamientos, reinicia mediante DTR, comprueba la firma ATmega328P, graba páginas de 128 bytes y **relee cada página para verificarla** antes de declarar éxito. No soporta Mega, Leonardo, Uno R4, Nano Every ni otras arquitecturas; no se les escribe por aproximación.

`arduinoStationSketch(calibrations, enabled)` genera una estación completa de ocho drivers a partir de `firmware/arduino/station.ino`. Usa solamente Arduino core y `math.h`: DHT11 y 1-Wire/DS18B20 llevan implementaciones incluidas, con timeouts y CRC. Descubre una ROM DS18B20 en cada conversión, pensada para la única sonda del kit. Escribe el mismo formato JSON que Pico; el navegador vinculado reenvía lecturas al servidor. **Uno/Nano no tiene Wi-Fi**: debe quedar conectado por USB con la pestaña abierta. El botón **Detener código** compila y carga un programa de reposo que deja D2–D13 en alta impedancia; reemplaza el sketch activo mientras tu borrador permanece en la web. Este botón necesita compilador disponible. El sketch integrado además acepta `STOP\n` y `RUN\n` desde la terminal; esos comandos solo sirven en programas que los implementan.

## Fuentes y validación

Implementación basada en documentación primaria: [raw REPL/raw-paste MicroPython](https://docs.micropython.org/en/v1.25.0/reference/repl.html), [TLS MicroPython](https://docs.micropython.org/en/v1.25.0/library/ssl.html), [Web Serial Chrome](https://developer.chrome.com/docs/capabilities/serial), [AVR061 STK500 Microchip](https://www.microchip.com/en-us/application-notes/an2525) y [Optiboot](https://github.com/Optiboot/optiboot/blob/master/optiboot/bootloaders/optiboot/optiboot.c). `onewire.py` y `ds18x20.py` se incluyen sin cambios funcionales desde [micropython-lib](https://github.com/micropython/micropython-lib), copyright Damien P. George. Se agregó el texto completo de la licencia MIT a sus cabeceras para que acompañe las copias instaladas; el repositorio también incluye `LICENSE-MICROPYTHON-LIB.txt`. No se requiere descargar librerías MicroPython manualmente.

Ejecuta `npm test -- tests/serial.test.ts`, `npm run test:firmware` y, con el servidor local iniciado, `npm run test:e2e -- tests/e2e/usb.spec.ts`. Las pruebas usan un peer de protocolo USB y pines mock; verifican flujo, UTF-8, captura, errores, validación HEX, grabación y lectura de páginas AVR, aislamiento de fallos, calibración, CA y política TLS. Chrome real ejecuta el flujo UI con ese peer explícito: editar/ejecutar/guardar código, parar, reconectar, instalar módulos, renovar credenciales revocadas y persistir lecturas USB cuando falla Wi-Fi. Se compiló realmente la estación integrada para Uno, Nano y Nano antiguo con Arduino CLI 1.4.1 y AVR core 1.8.6: **7930 bytes de flash y 233 bytes de RAM**. Los **29 ejemplos Arduino** disponibles del currículo también compilaron para Uno. Esto valida C++, HEX, UI y protocolo, no niveles eléctricos, tolerancias, bootloader real ni exactitud ambiental. La aceptación física requiere ejecutar LED, reconectar USB, desconectar DHT/DS, comprobar divisor ECHO, calibrar una planta real y probar TLS en una Pico W conectada.
