from machine import Pin
from time import sleep
tilt = Pin(4, Pin.IN, Pin.PULL_UP)
while True:
    print("Contacto:", tilt.value())
    sleep(0.1)
