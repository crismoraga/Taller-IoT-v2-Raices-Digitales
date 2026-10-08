from machine import Pin
from time import sleep
driver = Pin(3, Pin.OUT, value=0)
try:
    for _ in range(2):
        driver.on(); sleep(0.15)
        driver.off(); sleep(0.2)
finally:
    driver.off()
print("Alerta terminada")
