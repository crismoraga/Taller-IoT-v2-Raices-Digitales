from machine import Pin
from time import sleep
data, clock, latch = Pin(5, Pin.OUT), Pin(6, Pin.OUT), Pin(7, Pin.OUT)
def send(value):
    latch.off()
    for bit in range(7, -1, -1):
        clock.off(); data.value((value >> bit) & 1); clock.on()
    latch.on()
try:
    while True:
        send(1); sleep(0.5)
        send(0); sleep(0.5)
finally:
    send(0)
