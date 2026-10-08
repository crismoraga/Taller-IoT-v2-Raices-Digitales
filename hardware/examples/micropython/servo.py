from machine import Pin, PWM
from time import sleep
signal = PWM(Pin(20))
signal.freq(50)
try:
    for micros in (1300, 1500, 1700, 1500):
        signal.duty_u16(int(micros * 65535 / 20000))
        print("Pulso:", micros, "µs; periodo 20000 µs")
        sleep(0.5)
finally:
    signal.duty_u16(0)
    signal.deinit()
print("Señal apagada. La alimentación del motor debe estar validada aparte.")
