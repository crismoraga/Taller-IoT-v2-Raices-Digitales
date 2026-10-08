from machine import Pin
from time import sleep
import json

sensor = Pin(14, Pin.IN, Pin.PULL_DOWN)
while True:
    value = 1 - sensor.value()
    print(json.dumps({"sensor": "rain", "value": value, "unit": "0/1", "status": "UNVERIFIED"}))
    sleep(0.5)
