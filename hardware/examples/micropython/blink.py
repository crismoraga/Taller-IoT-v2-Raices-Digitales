from machine import Pin
from time import sleep

led = Pin(2, Pin.OUT)
intervalo = 0.5  # segundos: prueba 0.1 o 1
try:
    while True:
        led.toggle()
        print("LED:", led.value())
        sleep(intervalo)
finally:
    led.off()
