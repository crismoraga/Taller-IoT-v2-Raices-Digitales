# Resolver problemas durante el taller

| Síntoma | Comprobación y acción |
|---|---|
| No aparece «Conectar USB» o navegador incompatible | Chrome/Edge en escritorio, HTTPS o localhost. Firefox/Safari no ofrecen Web Serial equivalente. |
| Selector sin placa | Cable USB de datos; conecta sin BOOTSEL después de instalar UF2. Confirma puerto en el administrador de dispositivos. Algunos clones Nano necesitan driver CH340 del fabricante. |
| Puerto ocupado / acceso denegado | Cierra Thonny, Arduino IDE, monitor serial y otras pestañas. Desconecta USB, espera y vuelve a conectar. |
| Pico no responde al raw REPL | Selecciona Pico W; confirma MicroPython, no Arduino/CircuitPython. Detén código, reconecta, vuelve a ejecutar LED. Mantener BOOTSEL abre disco, no REPL. |
| LED no enciende | USB desconectado: comprueba GP2/pin físico 4, resistor 220 Ω, ánodo/cátodo, GND, filas y canal central de protoboard. |
| ADC cambia sin tocar sensor | Un cable flotante también produce números. Revisa VCC/GND/señal. No hay detección universal de sensores analógicos. |
| `NEEDS_CALIBRATION` | Captura extremos físicos separados. Pico usa 0–65535, Arduino 0–1023. Guarda y vuelve a instalar estación para aplicar referencias. |
| `UNVERIFIED` en analógico | Señal próxima a 0/3.3 V, saturación o circuito incorrecto. No asumir que el sensor está ausente. |
| DHT `NO_RESPONSE` | Verifica DATA GP15/D4, pull-up, alimentación de la variante y espera ≥2 s. No mojar. |
| DS18B20 `NO_RESPONSE` | GP16/D5, GND común, dos 10 kΩ en paralelo a 3V3, colores reales de la sonda. CRC fallido puede ser contacto o interferencia. |
| DS18B20 85 °C | Valor inicial posible. El driver solicita conversión y espera; comprueba alimentación y espera la siguiente muestra. |
| HC-SR04 sin eco | VCC 5 V, TRIG GP17, ECHO GP18 con divisor, objeto rígido a 2–400 cm. Un objeto lejano/blando también causa timeout. |
| PIR «estabilizando» | Espera un minuto después de alimentar. Revisa el jumper y ajuste del módulo; no detecta personas quietas. |
| Wi-Fi no conecta | SSID exacto y clave; red 2.4 GHz con DHCP. Pico W no entra en portal cautivo/WPA Enterprise del campus sin una red compatible. Usa un hotspot compatible permitido. |
| USB lee, dashboard vacío | Vincula la estación con el grupo actual, comprueba token revocado y endpoint `/api/device/ingest`. Para Arduino deja abierta la pestaña; sin USB no existe conexión de red. |
| Error TLS/certificado | Reloj UTC correcto, MicroPython con `CERT_REQUIRED`, CA correspondiente a tu servidor, hostname DNS exacto y cadena completa del servidor. No deshabilites validación. |
| Endpoint local falla desde Pico | `localhost` no apunta a tu computador. Debe ser un hostname alcanzable por Wi-Fi, con HTTPS y certificado confiable; la Pico usa la CA instalada. |
| Arduino «sin respuesta del bootloader» | Selecciona Uno, Nano o Nano antiguo; los clones antiguos suelen usar 57600. Revisa cable/driver, pulsa RESET justo al comenzar si no tiene auto-reset. |
| Firma Arduino incorrecta | Solo Uno/Nano ATmega328P. Mega, Leonardo, Uno R4 y Nano Every necesitan otros protocolos. |
| Compilador Arduino no disponible | Inicia el servicio de compilación documentado; la API informa disponibilidad. No se sustituye C++ por un firmware simulado. |
| Arduino no se detiene | Detener código compila y carga un sketch de reposo; espera a que termine la carga. Si no hay compilador o conexión USB, corta la alimentación. STOP por terminal solo funciona en el programa integrado o sketches que lo implementen. |
| Reinicio mientras instala | Reconecta e instala el bundle completo. Si el sistema de archivos está dañado, reinstala UF2 y vuelve a configurar. |
| Telegram no entrega alerta | El docente configura token/chat, inicia conversación con el bot y prueba envío. Comprueba estado de entrega; el dashboard conserva alertas aunque falle Telegram. |

Antes de cada taller prepara diez estaciones, comprueba cables de datos, firmware y red, y usa las dos unidades restantes de cada modelo como repuestos. Prueba conexión/reconexión, LED y la sonda de suelo con una cuenta de grupo. Los sensores resistivos de agua/lluvia se secan al terminar; no dejar energizados en agua durante días. Para modificar cableado desconecta alimentación y mantén la parte electrónica lejos de la maceta mojada.
