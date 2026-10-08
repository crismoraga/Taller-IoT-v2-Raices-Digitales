from machine import Pin
from time import sleep
import json

sensor = Pin(19, Pin.IN, Pin.PULL_DOWN)
while True:
    value = sensor.value()
    print(json.dumps({"sensor": "motion", "value": value, "unit": "0/1", "status": "UNVERIFIED"}))
    sleep(0.5)
