from machine import ADC, Pin
from time import sleep
adc = ADC(Pin(26))
while True:
    print("Posición:", adc.read_u16(), "/ 65535")
    sleep(0.2)
