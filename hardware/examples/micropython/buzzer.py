from machine import Pin, PWM
from time import sleep
sound = PWM(Pin(3))
try:
    sound.freq(880)
    sound.duty_u16(12000)
    sleep(0.3)
finally:
    sound.duty_u16(0)
    sound.deinit()
print("Prueba terminada")
