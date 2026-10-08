from machine import Pin
from time import sleep_ms
import network
network.WLAN(network.STA_IF).active(False)
pins = [Pin(p, Pin.OUT, value=0) for p in (20, 21, 22, 0)]
def off():
    for pin in pins: pin.off()
try:
    for direction in (1, -1):
        for step in range(128):
            off()
            pins[(step * direction) % 4].on()
            sleep_ms(8)
        off(); sleep_ms(300)
finally:
    off()
print("Motor liberado")
