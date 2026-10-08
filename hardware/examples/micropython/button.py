from machine import Pin
from time import sleep_ms
button = Pin(4, Pin.IN, Pin.PULL_UP)
previous = button.value()
while True:
    current = button.value()
    sleep_ms(20)
    if current == button.value() and current != previous:
        previous = current
        print("Pulsado" if current == 0 else "Libre")
