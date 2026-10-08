"""Pico W station: JSON over USB every ~2 s, verified HTTPS every >=5 s."""
import json
import time
import gc
from drivers import DriverRegistry
from connectivity import Cloud


def load_config():
    try:
        with open("config.json", "r") as file:
            config = json.load(file)
        if not isinstance(config, dict):
            raise ValueError("config.json debe contener un objeto")
        return config
    except OSError:
        # No auto-enabled floating inputs, no invented credentials.
        return {"enabled": {}}


def main():
    try:
        config = load_config()
    except Exception:
        print(json.dumps({"readings": [], "diagnostics": {"configError": "config.json inválido; instala nuevamente la configuración"}}))
        return
    drivers = DriverRegistry(config)
    cloud = Cloud(config)
    time.sleep_ms(1200)  # DHT power-up settling before the first 800 ms conversion.
    try:
        while True:
            started = time.ticks_ms()
            drivers.start_conversion()
            # DS18B20 conversion max 750 ms, DHT11 interval remains >2 seconds.
            for _ in range(8):
                cloud.tick()
                time.sleep_ms(100)
            readings = drivers.read_all()
            print(json.dumps({"readings": readings, "diagnostics": cloud.diagnostic()}))
            cloud.publish(readings)
            gc.collect()
            remaining = 2000 - time.ticks_diff(time.ticks_ms(), started)
            if remaining > 0:
                time.sleep_ms(remaining)
    except KeyboardInterrupt:
        print("Estación detenida. REPL USB disponible.")


if __name__ == "__main__":
    main()
