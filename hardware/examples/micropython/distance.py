from machine import Pin, time_pulse_us
from time import sleep, sleep_us
import json

trig = Pin(17, Pin.OUT, value=0)
echo = Pin(18, Pin.IN)
while True:
    trig.off(); sleep_us(2)
    trig.on(); sleep_us(10); trig.off()
    try:
        duration = time_pulse_us(echo, 1, 30000)
        if duration < 0: raise OSError("Sin eco dentro de 30 ms")
        cm = round(duration * 0.0343 / 2, 1)
        status = "READING" if 2 <= cm <= 400 else "OUT_OF_RANGE"
        print(json.dumps({"sensor": "distance", "value": cm, "unit": "cm", "status": status}))
    except OSError as error:
        print(json.dumps({"sensor": "distance", "value": None, "unit": "cm", "status": "NO_RESPONSE", "error": str(error)}))
    sleep(0.2)
