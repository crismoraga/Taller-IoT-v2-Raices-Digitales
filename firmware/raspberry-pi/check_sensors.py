#!/usr/bin/env python3
"""Read real sensors on Raspberry Pi 3/4 GPIO; emit workshop-compatible JSON.

Run with Raspberry Pi OS and a 40-pin header. This is a standalone Linux
checker, not an Arduino/Pico program. Dependencies are imported only for the
selected sensors. No sensor value, ADC calibration or physical presence is
invented. GPIO numbers below use BCM numbering, not header positions.
"""

import argparse
import importlib
import json
import math
from pathlib import Path
import re
import sys
import threading
import time


PIN_MAP = {
    "dht11": {"data": {"bcm": 22, "physical": 15}},
    "ds18b20": {"data": {"bcm": 4, "physical": 7}},
    "distance": {"trigger": {"bcm": 23, "physical": 16}, "echo": {"bcm": 24, "physical": 18}},
    "motion": {"out": {"bcm": 26, "physical": 37}},
    "rain": {"do": {"bcm": 17, "physical": 11}},
}
ADC_CHANNELS = {"soil": 0, "light": 1, "water_level": 2}
UNITS = {"air_temperature": "°C", "air_humidity": "%", "soil_temperature": "°C",
         "distance": "cm", "motion": "0/1", "rain": "0/1", "soil": "%", "light": "%", "water_level": "%"}
SENSORS = ("dht11", "ds18b20", "distance", "motion", "rain", "soil", "light", "water_level")
W1_ROOT = Path("/sys/bus/w1/devices")


def reading(sensor, value=None, status="READING", error=None, raw=None, confidence=None):
    result = {"sensor": sensor, "value": value, "unit": UNITS[sensor], "status": status}
    if error is not None:
        result["error"] = str(error)[:500]
    if raw is not None:
        result["raw"] = raw
    if confidence is not None:
        result["confidence"] = confidence
    return result


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


class FailedSensor:
    def __init__(self, sensors, message, status="ERROR"):
        self.sensors, self.message, self.status = sensors, message, status

    def read(self):
        return [reading(sensor, status=self.status, error=self.message) for sensor in self.sensors]

    def close(self):
        pass


class Dht11:
    def __init__(self, module, board):
        self.device = module.DHT11(board.D22, use_pulseio=False)

    def read(self):
        try:
            temperature, humidity = self.device.temperature, self.device.humidity
        except RuntimeError:
            return FailedSensor(("air_temperature", "air_humidity"),
                                "DHT11 sin respuesta válida. Revisa DATA → BCM22 (pin físico 15); se reintentará en 2 s.", "NO_RESPONSE").read()
        result = []
        for sensor, value, minimum, maximum in (("air_temperature", temperature, 0, 50), ("air_humidity", humidity, 20, 90)):
            if not finite(value):
                result.append(reading(sensor, status="NO_RESPONSE", error="DHT11 no entregó una lectura válida."))
            elif not minimum <= value <= maximum:
                result.append(reading(sensor, status="OUT_OF_RANGE", raw=value, error="Lectura fuera del rango nominal del DHT11."))
            else:
                result.append(reading(sensor, round(value, 1)))
        return result

    def close(self):
        self.device.exit()


class Ds18b20:
    def __init__(self, root=W1_ROOT, device_id=None):
        self.root, self.device_id = Path(root), device_id
        self.seen_conversion = False

    def read(self):
        sensor = "soil_temperature"
        if self.device_id:
            if not re.fullmatch(r"28-[a-fA-F0-9]{12}", self.device_id):
                return [reading(sensor, status="ERROR", error="Identificador DS18B20 inválido: usa 28- seguido de 12 caracteres hexadecimales.")]
            devices = [self.root / self.device_id]
        else:
            devices = sorted(path for path in self.root.glob("28-*") if path.is_dir())
        if len(devices) != 1:
            message = ("Hay varios DS18B20: selecciona uno con --w1-device 28-xxxxxxxxxxxx." if devices else
                       "DS18B20 no detectado. DATA → BCM4 (pin 7), pull-up de 4,7–5 kΩ a 3,3 V y overlay w1-gpio activo.")
            return [reading(sensor, status="ERROR" if devices else "NO_RESPONSE", error=message)]
        try:
            # Kernel w1 therm performs the conversion and reports the CRC.
            text = (devices[0] / "w1_slave").read_text(encoding="ascii")
        except (OSError, UnicodeError):
            return [reading(sensor, status="NO_RESPONSE", error="No se pudo leer el DS18B20 en el bus 1-Wire.")]
        lines = text.splitlines()
        if len(lines) < 2 or not lines[0].rstrip().endswith("YES"):
            return [reading(sensor, status="NO_RESPONSE", error="CRC DS18B20 inválido; se reintentará la conversión.")]
        match = re.search(r"(?:^|\s)t=(-?\d+)(?:\s|$)", lines[1])
        if not match:
            return [reading(sensor, status="NO_RESPONSE", error="DS18B20 no entregó temperatura.")]
        milli = int(match.group(1))
        if milli == 85000 and not self.seen_conversion:
            # 85 °C is the power-on scratchpad value. It is legitimate after a
            # second CRC-valid conversion; do not blacklist 85 °C forever.
            self.seen_conversion = True
            return [reading(sensor, status="NO_RESPONSE", error="Primera conversión DS18B20 en 85 °C; espera la siguiente lectura.")]
        self.seen_conversion = True
        if not -55000 <= milli <= 125000:
            return [reading(sensor, status="OUT_OF_RANGE", raw=milli / 1000, error="Temperatura fuera del rango DS18B20 (−55 a 125 °C).")]
        return [reading(sensor, round(milli / 1000, 3))]

    def close(self):
        pass


class DigitalSensor:
    def __init__(self, gpiozero, sensor):
        self.sensor = sensor
        pin = PIN_MAP[sensor]["do" if sensor == "rain" else "out"]["bcm"]
        # FC-37 DO is active-low; PIR OUT is active-high. A reading describes
        # the actual GPIO level and cannot identify an unplugged sensor.
        self.device = gpiozero.DigitalInputDevice(pin, pull_up=sensor == "rain")

    def read(self):
        active = bool(self.device.is_active)
        return [reading(self.sensor, int(active), confidence="Nivel GPIO real; no identifica presencia física del sensor.")]

    def close(self):
        self.device.close()


class Ultrasonic:
    def __init__(self, gpiozero, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.Lock()
        self.sample = (None, None)
        owner = self

        class TrackedDistanceSensor(gpiozero.DistanceSensor):
            def _read(self):
                # gpiozero bounds echo-low/echo-rise waits to 50/100 ms. Keep
                # the latest attempt, including failure: .distance may block
                # indefinitely when its smoothing queue has never had an echo.
                value = super()._read()
                with owner.lock:
                    owner.sample = (owner.clock(), value)
                return value

        self.device = TrackedDistanceSensor(echo=24, trigger=23, max_distance=4, queue_len=1, partial=True)

    def read(self):
        with self.lock:
            captured, value = self.sample
        if captured is None or self.clock() - captured > 0.6 or not finite(value):
            return [reading("distance", status="NO_RESPONSE", error="HC-SR04 sin eco reciente. TRIG → BCM23 (pin 16); ECHO → divisor → BCM24 (pin 18).")]
        if not 0.005 <= value < 1:
            return [reading("distance", status="OUT_OF_RANGE", error="Objeto fuera del rango HC-SR04 (2–400 cm).")]
        return [reading("distance", round(value * 400, 1))]

    def close(self):
        self.device.close()


class AnalogSensor:
    def __init__(self, gpiozero, sensor):
        self.sensor = sensor
        self.device = gpiozero.MCP3008(channel=ADC_CHANNELS[sensor], port=0, device=0)

    def read(self):
        raw = self.device.raw_value
        if not finite(raw) or not 0 <= raw <= 1023:
            return [reading(self.sensor, status="NO_RESPONSE", error="MCP3008 no entregó una muestra ADC válida.")]
        return [reading(self.sensor, status="NEEDS_CALIBRATION", raw=raw,
                        error="ADC real sin calibrar: se muestra raw (0–1023), no un porcentaje inventado.",
                        confidence="SPI no identifica físicamente el MCP3008; confirma el chip y su cableado.")]

    def close(self):
        self.device.close()


def make_sensor(sensor, adc=None, w1_root=W1_ROOT, w1_device=None, spi_path=Path("/dev/spidev0.0")):
    keys = ("air_temperature", "air_humidity") if sensor == "dht11" else ("soil_temperature" if sensor == "ds18b20" else sensor,)
    if sensor == "ds18b20":
        return Ds18b20(w1_root, w1_device)
    if sensor in ADC_CHANNELS and adc != "mcp3008":
        return FailedSensor(keys, "Raspberry Pi 3/4 no tiene entradas analógicas. Necesitas MCP3008 conectado y --adc mcp3008 para este sensor.")
    if sensor in ADC_CHANNELS and not Path(spi_path).exists():
        return FailedSensor(keys, "SPI0 no está disponible: activa SPI y conecta MCP3008 (CH0 suelo, CH1 luz, CH2 nivel de agua).")
    try:
        if sensor == "dht11":
            return Dht11(importlib.import_module("adafruit_dht"), importlib.import_module("board"))
        gpiozero = importlib.import_module("gpiozero")
        if sensor == "distance":
            return Ultrasonic(gpiozero)
        if sensor in ADC_CHANNELS:
            return AnalogSensor(gpiozero, sensor)
        return DigitalSensor(gpiozero, sensor)
    except ImportError:
        message = ("Falta DHT11: instala adafruit-circuitpython-dht en el entorno Python de esta Pi." if sensor == "dht11" else
                   "Falta gpiozero: instala python3-gpiozero en esta Raspberry Pi.")
        return FailedSensor(keys, message)
    except Exception as error:
        # GPIO initialization messages have no credentials; return a concise
        # diagnostic per selected sensor instead of crashing the entire check.
        return FailedSensor(keys, "No se pudo abrir este sensor GPIO/SPI: " + str(error)[:300])


def read_frame(devices):
    readings = []
    for sensor, device in devices:
        try:
            readings.extend(device.read())
        except Exception as error:
            keys = ("air_temperature", "air_humidity") if sensor == "dht11" else ("soil_temperature" if sensor == "ds18b20" else sensor,)
            readings.extend(FailedSensor(keys, "Fallo de lectura GPIO/SPI: " + str(error)[:300]).read())
    return {"source": "hardware", "readings": readings,
            "diagnostics": {"host": "Raspberry Pi OS", "transport": "GPIO / 1-Wire / SPI", "sampleIntervalMs": 2000}}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Comprueba sensores reales en GPIO de Raspberry Pi 3/4. Salida JSON cada 2 segundos.")
    parser.add_argument("--sensor", action="append", required=True,
                        help="Sensor a comprobar (repetible o separados por coma): " + ", ".join(SENSORS))
    parser.add_argument("--once", action="store_true", help="Una comprobación y finalizar")
    parser.add_argument("--adc", choices=("mcp3008",), help="Usa el MCP3008 físico conectado a SPI0 CE0")
    parser.add_argument("--w1-device", help="DS18B20 específico: 28-xxxxxxxxxxxx")
    args = parser.parse_args(argv)
    selected = list(dict.fromkeys(item.strip() for group in args.sensor for item in group.split(",")))
    if not selected or any(item not in SENSORS for item in selected):
        parser.error("Elige sensores válidos: " + ", ".join(SENSORS))
    devices = []
    try:
        for sensor in selected:
            devices.append((sensor, make_sensor(sensor, adc=args.adc, w1_device=args.w1_device)))
        # HC-SR04 uses a background pulse reader. Give its first bounded echo
        # attempt time to finish; DHT11 does not need an arbitrary startup wait.
        if "distance" in selected:
            time.sleep(0.2)
        while True:
            began = time.monotonic()
            frame = read_frame(devices)
            print(json.dumps(frame, ensure_ascii=False, allow_nan=False), flush=True)
            if args.once:
                return 0 if all(row["status"] == "READING" for row in frame["readings"]) else 1
            time.sleep(max(0, 2 - (time.monotonic() - began)))
    except KeyboardInterrupt:
        return 0
    except BrokenPipeError:
        return 0
    finally:
        for _, device in devices:
            try:
                device.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
