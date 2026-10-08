from machine import Pin
from time import sleep
import dht, json

sensor = dht.DHT11(Pin(15))
sleep(2)
while True:
    try:
        sensor.measure()
        for name, value, unit in (("air_temperature", sensor.temperature(), "°C"), ("air_humidity", sensor.humidity(), "%")):
            print(json.dumps({"sensor": name, "value": value, "unit": unit, "status": "READING"}))
    except OSError as error:
        for name, unit in (("air_temperature", "°C"), ("air_humidity", "%")):
            print(json.dumps({"sensor": name, "value": None, "unit": unit, "status": "NO_RESPONSE", "error": str(error)}))
    sleep(2)
