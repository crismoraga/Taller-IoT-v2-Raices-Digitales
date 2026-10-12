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
        self.calibration = calibration if isinstance(calibration, dict) else {}

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
        # References must belong to this ADC family. JSON booleans, NaN and
        # a low-range untagged AVR backup are not real Pico references.
        valid = (type(dry) in (int, float) and type(wet) in (int, float)
                 and 0 <= dry <= 65535 and 0 <= wet <= 65535
                 and int(dry) == dry and int(wet) == wet
                 and abs(wet - dry) >= 500
                 and (self.calibration.get("board") == "pico"
                      or ("board" not in self.calibration and max(dry, wet) > 1023)))
        if not valid:
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
        self.started = None

    def start(self):
        # Rediscover every sample so a later reconnection can recover by itself.
        self.converting = False
        self.started = None
        # A discovered address must have a valid CRC before it is selected.
        self.roms = [rom for rom in self.device.scan()
                     if len(rom) == 8 and self.device.ow.crc8(rom) == 0]
        if self.roms:
            self.device.convert_temp()
            self.converting = True
            self.started = time.ticks_ms()
        else:
            self.converting = False

    def read(self):
        if not self.roms:
            return [reading("soil_temperature", None, "°C", "NO_RESPONSE", error="No se encontró DS18B20; revisa pull-up de 5 kΩ y GP16")]
        if not self.converting or self.started is None or time.ticks_diff(time.ticks_ms(), self.started) < 750:
            return [reading("soil_temperature", None, "°C", "UNVERIFIED", error="Conversión DS18B20 pendiente")]
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
        config = config if isinstance(config, dict) else {}
        enabled = config.get("enabled", config.get("sensorEnabled", {}))
        self.enabled = {key: value for key, value in enabled.items() if type(value) is bool} if isinstance(enabled, dict) else {}
        calibration = config.get("calibration", config.get("calibrations", {}))
        calibration = calibration if isinstance(calibration, dict) else {}
        factories = {"soil": lambda: AnalogSensor("soil", calibration.get("soil")),
                     "light": lambda: AnalogSensor("light", calibration.get("light")),
                     "water_level": lambda: AnalogSensor("water_level", calibration.get("water_level")),
                     "rain": RainSensor, "motion": MotionSensor, "dht11": DHTSensor,
                     "soil_temperature": SoilTemperatureSensor, "distance": DistanceSensor}
        self.drivers = {}
        self.errors = {}
        self.factories = factories
        self.next_retry = {}
        for key, factory in factories.items():
            if not self.is_enabled(key):
                continue
            try:
                self.drivers[key] = factory()
            except Exception as error:
                self.errors[key] = str(error)
                self.next_retry[key] = time.ticks_add(time.ticks_ms(), 2000)

    def is_enabled(self, key):
        return any(self.enabled.get(sensor, self.enabled.get(key, False)) for sensor in self.GROUPS[key])

    def recover(self):
        # Retry only missing drivers, once per sample; healthy sensors keep
        # their warm-up timers and one failed module cannot hide the others.
        for key, factory in self.factories.items():
            if key in self.drivers or not self.is_enabled(key):
                continue
            if time.ticks_diff(time.ticks_ms(), self.next_retry.get(key, 0)) < 0:
                continue
            try:
                self.drivers[key] = factory()
                self.errors.pop(key, None)
                self.next_retry.pop(key, None)
            except Exception as error:
                self.errors[key] = str(error)
                self.next_retry[key] = time.ticks_add(time.ticks_ms(), 2000)

    def start_conversion(self):
        self.recover()
        sensor = self.drivers.get("soil_temperature")
        if sensor:
            try:
                sensor.start()
                self.errors.pop("soil_temperature", None)
            except Exception as error:
                self.errors["soil_temperature"] = str(error)

    def read_all(self):
        self.recover()
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
