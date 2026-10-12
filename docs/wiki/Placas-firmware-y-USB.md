# Placas, firmware y USB

Perfiles: Raspberry Pi Pico/Pico W/Pico 2/Pico 2 W con MicroPython; Arduino Uno ATmega328P y Nano ATmega328P/ATmega168 con AVR clásico. El listado de FQBN, firmas, velocidades y límites de memoria está en la [matriz de placas](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/SUPPORTED_BOARDS.md).

- Pico usa la imagen oficial MicroPython específica de su modelo. USB es el transporte inicial; Wi-Fi es opcional y solo existe en modelos W.
- Uno/Nano se compilan con Arduino CLI real y se cargan mediante Web Serial/STK500v1. Nano ATmega168 usa firma `1E 94 06` y 19200 baud; no es un alias de Nano 328P.
- La selección USB no determina el MCU/bootloader de Nano. Si la firma no coincide, el cargador no inicia la escritura.
- Web Serial requiere permiso del navegador y que ningún otro programa mantenga el puerto abierto.
- Tests con peer serial/bootloader virtual verifican bytes, respuesta y recuperación; no prueban la unidad física.

Guía del firmware: [FIRMWARE.md](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/FIRMWARE.md). Para STK500, raw REPL, USB ocupado, firma incorrecta o Wi-Fi/TLS consulta [solución de problemas](https://github.com/crismoraga/Taller-IoT-v2-Raices-Digitales/blob/main/docs/TROUBLESHOOTING.md).
