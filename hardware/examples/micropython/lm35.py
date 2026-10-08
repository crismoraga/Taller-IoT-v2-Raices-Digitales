from machine import ADC, Pin
from time import sleep
adc = ADC(Pin(26))
while True:
    raw = sum(adc.read_u16() for _ in range(16)) / 16
    volts = raw * 3.3 / 65535
    print("Temperatura LM35:", round(volts * 100, 1), "°C (aproximada)")
    sleep(1)
