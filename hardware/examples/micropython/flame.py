from machine import Pin
from time import sleep
sensor = Pin(12, Pin.IN, Pin.PULL_UP)
while True:
    print("DO óptico:", sensor.value(), "(polaridad según módulo)")
    sleep(0.1)
