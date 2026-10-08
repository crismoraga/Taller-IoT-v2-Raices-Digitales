from machine import Pin
from time import sleep, sleep_ms
import onewire, ds18x20, json

sensor = ds18x20.DS18X20(onewire.OneWire(Pin(16)))
while True:
    try:
        roms = [r for r in sensor.scan() if r[0] == 0x28]
        if not roms:
            raise OSError("No se encontró DS18B20 en GP16")
        sensor.convert_temp()
        sleep_ms(750)
        value = sensor.read_temp(roms[0])
        print(json.dumps({"sensor": "soil_temperature", "value": value, "unit": "°C", "status": "READING"}))
    except Exception as error:
        print(json.dumps({"sensor": "soil_temperature", "value": None, "unit": "°C", "status": "NO_RESPONSE", "error": str(error)}))
    sleep(1)
