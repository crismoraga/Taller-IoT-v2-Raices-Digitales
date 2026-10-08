from machine import Pin
led = Pin(2, Pin.OUT)
led.value(1)
print("LED encendido. Cambia 1 por 0 y vuelve a ejecutar.")
