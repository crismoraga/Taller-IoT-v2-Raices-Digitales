from machine import Pin
from time import sleep_us

# Actividad individual: retira el montaje de estación.
# Confirma A..G y COM/D1..D4 en la ficha de TU display.
COMMON_ANODE = False  # cambia a True solo si tu modelo es ánodo común
segments = [Pin(p, Pin.OUT) for p in (5, 6, 7, 8, 9, 10, 11)]
commons = [Pin(p, Pin.OUT) for p in (12,)]
# Cada COM tiene una resistencia de 1 kΩ. Solo UN LED a la vez.
digits = (0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F)
values = [2]
on, off = (0, 1) if COMMON_ANODE else (1, 0)
def blank():
    for c in commons: c.value(on)  # COM inactivo
    for s in segments: s.value(off)
blank()
try:
    while True:
        for d, value in enumerate(values):
            for seg in range(7):
                blank()
                if digits[value] & (1 << seg):
                    segments[seg].value(on)
                    commons[d].value(off)
                sleep_us(700)
finally:
    blank()
