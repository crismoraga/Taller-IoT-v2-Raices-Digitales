"""Independent real sensor drivers. An ADC voltage cannot prove sensor presence."""
from machine import Pin, ADC, time_pulse_us
import time
from board import PINS


def reading(sensor, value, unit, status="READING", raw=None, confidence=None, error=None):
    result = {"sensor": sensor, "value": value, "unit": unit, "status": status}
    if raw is not None:
        result["raw"] = raw
    if confidence:
        result["confidence"] = confidence
    if error:
        result["error"] = str(error)[:160]
    return result


class AnalogSensor:
    def __init__(self, sensor, calibration=None):
        self.sensor = sensor
        self.adc = ADC(PINS[sensor])
        self.calibration = calibration or {}

    def read(self):
        samples = sorted(self.adc.read_u16() for _ in range(9))
        raw = samples[4]
        dry = self.calibration.get("dry")
        wet = self.calibration.get("wet")
        # Near-rail readings may mean saturation, a loose wire, or a real state.
        if raw < 150 or raw > 65385:
            return [reading(self.sensor, None, "%", "UNVERIFIED", raw,
                            "No se puede confirmar presencia con una entrada analógica",
                            "Señal cerca de un riel; revisa alimentación y cableado")]
        if self.sensor == "light" and dry is None and wet is None:
            return [reading(self.sensor, round(raw * 100 / 65535, 1), "%", "READING", raw,
                            "Luz relativa; no mide lux ni confirma presencia")]
        if not isinstance(dry, (int, float)) or not isinstance(wet, (int, float)) or abs(wet - dry) < 500:
            return [reading(self.sensor, None, "%", "NEEDS_CALIBRATION", raw,
                            "Registra ambos extremos físicos; diferencia mínima 500")]
        percent = (raw - dry) * 100 / (wet - dry)
        status = "OUT_OF_RANGE" if percent < -15 or percent > 115 else "READING"
        return [reading(self.sensor, round(max(0, min(100, percent)), 1), "%", status, raw,
                        "Estimación relativa calibrada; presencia no verificable")]


class RainSensor:
    def __init__(self):
        self.pin = Pin(PINS["rain"], Pin.IN, Pin.PULL_UP)

    def read(self):
        raw = self.pin.value()
        return [reading("rain", 1 - raw, "0/1", "UNVERIFIED", raw,
                        "LM393 activo en bajo; el estado no confirma presencia")]


class MotionSensor:
    def __init__(self):
        self.pin = Pin(PINS["motion"], Pin.IN, Pin.PULL_DOWN)
        self.started = time.ticks_ms()

    def read(self):
        if time.ticks_diff(time.ticks_ms(), self.started) < 60000:
            return [reading("motion", None, "0/1", "UNVERIFIED", error="PIR estabilizando: espera 60 segundos")]
        raw = self.pin.value()
        return [reading("motion", raw, "0/1", "UNVERIFIED", raw,
                        "Salida digital; un cero no distingue reposo de desconexión")]


class DHTSensor:
    def __init__(self):
        import dht  # Native driver included in official RPI_PICO_W MicroPython.
        self.device = dht.DHT11(Pin(PINS["dht11"]))

    def read(self):
        self.device.measure()
        temperature, humidity = self.device.temperature(), self.device.humidity()
        return [reading("air_temperature", temperature, "°C", "READING" if 0 <= temperature <= 50 else "OUT_OF_RANGE", confidence="DHT11 con respuesta válida"),
                reading("air_humidity", humidity, "%", "READING" if 20 <= humidity <= 90 else "OUT_OF_RANGE", confidence="DHT11 con respuesta válida")]


class SoilTemperatureSensor:
    def __init__(self):
        import onewire
        import ds18x20
        self.device = ds18x20.DS18X20(onewire.OneWire(Pin(PINS["soil_temperature"])))
        self.roms = []
        self.converting = False

    def start(self):
        # Rediscover every sample so a later reconnection can recover by itself.
        self.roms = self.device.scan()
        if self.roms:
            self.device.convert_temp()
            self.converting = True
        else:
            self.converting = False

    def read(self):
        if not self.roms:
            return [reading("soil_temperature", None, "°C", "NO_RESPONSE", error="No se encontró DS18B20; revisa pull-up de 5 kΩ y GP16")]
        value = self.device.read_temp(self.roms[0])
        status = "READING" if -55 <= value <= 125 and value != 85 else "UNVERIFIED"
        return [reading("soil_temperature", round(value, 2), "°C", status,
                        confidence="ROM descubierta y CRC válido", error="85 °C puede ser valor de arranque" if value == 85 else None)]


class DistanceSensor:
    def __init__(self):
        self.trigger = Pin(PINS["trigger"], Pin.OUT, value=0)
        self.echo = Pin(PINS["echo"], Pin.IN)

    def read(self):
        self.trigger.value(0)
        time.sleep_us(2)
        self.trigger.value(1)
        time.sleep_us(10)
        self.trigger.value(0)
        duration = time_pulse_us(self.echo, 1, 30000)
        if duration < 0:
            return [reading("distance", None, "cm", "NO_RESPONSE", error="Sin eco: objeto fuera de rango, cableado o sensor ausente")]
        cm = duration / 58.0
        return [reading("distance", round(cm, 1), "cm", "READING" if 2 <= cm <= 400 else "OUT_OF_RANGE",
                        raw=duration, confidence="Eco medido; no distingue todas las causas de fallo")]


class DriverRegistry:
    """One failed sensor never blocks the other seven drivers."""
    GROUPS = {"soil": ("soil",), "light": ("light",), "water_level": ("water_level",),
              "rain": ("rain",), "motion": ("motion",),
              "dht11": ("air_temperature", "air_humidity"),
              "soil_temperature": ("soil_temperature",), "distance": ("distance",)}
    UNITS = {"soil": "%", "light": "%", "water_level": "%", "rain": "0/1", "motion": "0/1",
             "air_temperature": "°C", "air_humidity": "%", "soil_temperature": "°C", "distance": "cm"}

    def __init__(self, config):
        self.enabled = config.get("enabled", config.get("sensorEnabled", {}))
        calibration = config.get("calibration", config.get("calibrations", {}))
        factories = {"soil": lambda: AnalogSensor("soil", calibration.get("soil")),
                     "light": lambda: AnalogSensor("light", calibration.get("light")),
                     "water_level": lambda: AnalogSensor("water_level", calibration.get("water_level")),
                     "rain": RainSensor, "motion": MotionSensor, "dht11": DHTSensor,
                     "soil_temperature": SoilTemperatureSensor, "distance": DistanceSensor}
        self.drivers = {}
        self.errors = {}
        for key, factory in factories.items():
            if not self.is_enabled(key):
                continue
            try:
                self.drivers[key] = factory()
            except Exception as error:
                self.errors[key] = str(error)

    def is_enabled(self, key):
        return self.enabled.get(key, any(self.enabled.get(sensor, False) for sensor in self.GROUPS[key]))

    def start_conversion(self):
        sensor = self.drivers.get("soil_temperature")
        if sensor:
            try:
                sensor.start()
                self.errors.pop("soil_temperature", None)
            except Exception as error:
                self.errors["soil_temperature"] = str(error)

    def read_all(self):
        results = []
        for key, ids in self.GROUPS.items():
            if not self.is_enabled(key):
                results.extend(reading(sensor, None, self.UNITS[sensor], "DISABLED") for sensor in ids)
                continue
            try:
                if key not in self.drivers:
                    raise OSError(self.errors.get(key, "Inicialización fallida"))
                if key == "soil_temperature" and key in self.errors:
                    raise OSError(self.errors[key])
                rows = self.drivers[key].read()
                for row in rows:
                    if self.enabled.get(row["sensor"], self.enabled.get(key, False)):
                        results.append(row)
                    else:
                        results.append(reading(row["sensor"], None, self.UNITS[row["sensor"]], "DISABLED"))
            except Exception as error:
                results.extend(reading(sensor, None, self.UNITS[sensor],
                                       "NO_RESPONSE" if self.enabled.get(sensor, self.enabled.get(key, False)) else "DISABLED",
                                       error=error if self.enabled.get(sensor, self.enabled.get(key, False)) else None) for sensor in ids)
        return results
