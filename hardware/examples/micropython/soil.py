from machine import ADC, Pin
from time import sleep
import json

sensor = ADC(Pin(26))

while True:
    raw = sum(sensor.read_u16() for _ in range(16)) // 16
    print(json.dumps({"sensor": "soil", "value": None, "raw": raw,
                      "unit": "%", "status": "NEEDS_CALIBRATION"}))
    sleep(1)
