# Hardware educativo

El mapa completo y las precauciones están en [docs/HARDWARE.md](../docs/HARDWARE.md). La experiencia web contiene veintinueve actividades ejecutables: seis del recorrido de una hora y veintitrés de laboratorio.

`examples/micropython/` y `examples/arduino/` contienen las mismas fuentes que carga el editor. Cada ejemplo es una actividad individual: antes de cambiar, detén el programa y comprueba el montaje correspondiente. Los ejemplos analógicos transmiten raw y `NEEDS_CALIBRATION`, no inventan porcentajes. LM35/potenciómetro comparten ADC con la sonda suelo y no se montan simultáneamente.

El firmware de estación se encuentra en `firmware/` y se instala desde Conectar. La estación final tiene drivers independientes para suelo, DHT11, DS18B20, LDR, FC-37, nivel, HC-SR04 y PIR; una falla de sensor no debe impedir leer los demás. Los ejemplos de LED y componentes adicionales son actividades de aprendizaje, no sensores agregados sin espacio a la estación final.

Arduino Uno/Nano AVR necesita bibliotecas DHT sensor library, Adafruit Unified Sensor, OneWire y DallasTemperature para los ejemplos individuales correspondientes. El compilador del despliegue instala/valida esas dependencias. Arduino no posee Wi-Fi: la web recibe JSON por USB y lo envía al servidor autorizado.

Los puertos `machine`, `dht`, `onewire` y `ds18x20` son módulos de MicroPython para Pico W; usa el firmware indicado por el docente. Los archivos no contienen SSID, contraseñas ni tokens. Para uso cloud, genera tu configuración privada desde Conectar y usa una URL que la placa pueda alcanzar.

Después de modificar `web/data/lessons.ts`, regenera los ejemplos con `node --import tsx hardware/export-examples.mjs` desde la raíz. `sensor-matrix.json` es la matriz de sensores y limitaciones exportada de la misma fuente.

El LCD usa driver paralelo de cuatro bits, no necesita módulo I2C. IR implementa NEC sin dependencia externa. Displays/matriz escanean un LED por vez con las resistencias inventariadas. Motor paso a paso usa ULN2003 y necesita presupuesto de alimentación validado para su bobina. SG90 dispone de controlador PWM acotado y un circuito LED para la señal: **su alimentación de potencia no está garantizada por el kit actual**, y no se afirma movimiento sin fuente regulada validada.
