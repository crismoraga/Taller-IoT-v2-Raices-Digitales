from machine import Pin, time_pulse_us
from time import sleep_ms
receiver = Pin(13, Pin.IN, Pin.PULL_UP)
print("Apunta el mando y pulsa una tecla NEC")
while True:
    try:
        mark = time_pulse_us(receiver, 0, 100000)
        if not 8000 <= mark <= 10000: continue
        space = time_pulse_us(receiver, 1, 6000)
        if not 3500 <= space <= 5500: continue
        frame = 0
        for bit in range(32):
            mark = time_pulse_us(receiver, 0, 3000)
            space = time_pulse_us(receiver, 1, 3000)
            if not 300 <= mark <= 900 or space < 300: raise ValueError("Pulso inválido")
            if space > 1100: frame |= 1 << bit
        command, inverse = (frame >> 16) & 255, (frame >> 24) & 255
        if command ^ inverse == 255:
            print("NEC:", hex(frame), "comando:", hex(command))
        else:
            print("NEC inválido: comando no coincide con su inverso")
    except (OSError, ValueError):
        sleep_ms(5)
