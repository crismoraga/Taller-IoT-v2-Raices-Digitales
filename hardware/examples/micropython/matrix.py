from machine import Pin
from time import sleep_us
ROW_ANODE = True  # confirmar polaridad del modelo
rows = [Pin(p, Pin.OUT) for p in range(8)]
cols = [Pin(p, Pin.OUT) for p in range(8, 16)]
bitmap = [0x18, 0x3C, 0x7E, 0xDB, 0x7E, 0x3C, 0x18, 0x18]
def blank():
    for r in rows: r.value(0 if ROW_ANODE else 1)
    for c in cols: c.value(1 if ROW_ANODE else 0)
blank()
try:
    while True:
        for y in range(8):
            for x in range(8):
                blank()
                if bitmap[y] & (1 << (7-x)):
                    rows[y].value(1 if ROW_ANODE else 0)
                    cols[x].value(0 if ROW_ANODE else 1)
                sleep_us(150)
finally:
    blank()
