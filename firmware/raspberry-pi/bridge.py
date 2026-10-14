#!/usr/bin/env python3
"""Raspberry Pi OS: forward real Arduino USB readings to the workshop.

This is a Linux host bridge, not firmware for Raspberry Pi GPIO. Install the
station on Arduino using the web app first, then disconnect its browser port.
Only pyserial is required: sudo apt install python3-serial
"""

import argparse
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


UNITS = {
    "soil": "%", "soil_temperature": "°C", "air_temperature": "°C",
    "air_humidity": "%", "light": "%", "rain": "0/1",
    "water_level": "%", "distance": "cm", "motion": "0/1",
}
STATUSES = {
    "READING", "NEEDS_CALIBRATION", "NO_RESPONSE", "OUT_OF_RANGE",
    "UNVERIFIED", "DISABLED", "ERROR",
}
DEFAULT_CONFIG = Path.home() / ".config" / "raices-digitales" / "pi-bridge.json"


def finite(value):
    try:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    except OverflowError:
        return False


def server_origin(value):
    """No credentials, arbitrary paths, query tokens or unverified HTTP."""
    if not isinstance(value, str) or any(ord(c) < 33 for c in value):
        raise ValueError("Usa la dirección HTTPS del taller.")
    parsed = urllib.parse.urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment):
        raise ValueError("Usa la dirección HTTPS del taller, sin /api ni credenciales.")
    try:
        if parsed.port is not None and not 1 <= parsed.port <= 65535:
            raise ValueError("Puerto HTTPS inválido.")
    except ValueError:
        raise ValueError("Puerto HTTPS inválido.") from None
    return value.rstrip("/")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    # A device token must never follow a redirect to another host.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class DeliveryError(Exception):
    def __init__(self, status=0):
        self.status = status
        super().__init__("El servidor no aceptó la conexión." if status else "El servidor no está disponible.")


def post_json(origin, path, payload, token=None, opener=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token is not None:
        if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
            raise ValueError("Credencial del puente inválida. Genera un código nuevo en el taller.")
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(
        server_origin(origin) + path,
        data=json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8"),
        headers=headers, method="POST",
    )
    opener = opener or urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(request, timeout=5) as response:
            raw = response.read(65537)
            if len(raw) > 65536:
                raise DeliveryError(502)
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise DeliveryError(502)
            return data
    except urllib.error.HTTPError as error:
        # Neither the response body nor the request's bearer token is logged.
        raise DeliveryError(error.code) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise DeliveryError() from None


def validate_config(config):
    if not isinstance(config, dict):
        raise ValueError("Configuración inválida. Vincula de nuevo la Raspberry Pi.")
    config = dict(config)
    config["server"] = server_origin(config.get("server"))
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", str(config.get("token", ""))):
        raise ValueError("Credencial inválida. Vincula de nuevo la Raspberry Pi.")
    try:
        uuid.UUID(config["deviceId"])
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValueError("Dispositivo inválido. Vincula de nuevo la Raspberry Pi.") from None
    if not isinstance(config.get("port"), str) or not re.fullmatch(r"/dev/[A-Za-z0-9_./-]+", config["port"]):
        raise ValueError("Especifica el puerto Arduino: /dev/ttyACM0 o /dev/ttyUSB0.")
    return config


def save_config(path, config):
    """Atomic local credential, readable only by the Raspberry Pi account."""
    config = validate_config(config)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".new")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(config, file, ensure_ascii=False)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def pair_device(origin, code, port, request=post_json):
    if not isinstance(code, str) or not re.fullmatch(r"[A-Fa-f0-9]{12}", code):
        raise ValueError("Genera un código de 12 caracteres en Ajustes → Raspberry Pi 3 / 4.")
    origin = server_origin(origin)
    # Validate the local port before consuming the one-use pairing code.
    validate_config({"server": origin, "deviceId": str(uuid.UUID(int=0)), "token": "a" * 43, "port": port})
    result = request(origin, "/api/device/pair", {"code": code.upper()})
    return validate_config({"server": origin, "port": port, "deviceId": result.get("deviceId"), "token": result.get("token")})


def telemetry_frame(line):
    """Preserve actual values, null/error states and ADC raw; never invent data."""
    try:
        frame = json.loads(line)
    except (ValueError, UnicodeDecodeError, RecursionError):
        return None
    if not isinstance(frame, dict):
        return None
    readings = frame.get("readings")
    if readings is None and "sensor" in frame:
        readings = [frame]
    if not isinstance(readings, list) or not 1 <= len(readings) <= 32:
        return None
    clean, seen = [], set()
    for item in readings:
        if not isinstance(item, dict):
            return None
        sensor, value, status = item.get("sensor"), item.get("value"), item.get("status")
        if (not isinstance(sensor, str) or sensor not in UNITS or sensor in seen or item.get("unit") != UNITS[sensor]
                or not isinstance(status, str) or status not in STATUSES or (value is not None and (not finite(value) or abs(value) > 100000))
                or (status == "READING" and value is None)):
            return None
        seen.add(sensor)
        reading = {"sensor": sensor, "value": value, "unit": UNITS[sensor], "status": status}
        for key, limit in (("confidence", 100), ("error", 500)):
            if key in item:
                if not isinstance(item[key], str) or len(item[key]) > limit:
                    return None
                reading[key] = item[key]
        if "raw" in item:
            if not finite(item["raw"]):
                return None
            reading["raw"] = item["raw"]
        # The API records reception time. A USB firmware clock is not trusted.
        clean.append(reading)
    diagnostics = {"host": "Raspberry Pi OS", "transport": "Arduino USB", "baudRate": 115200}
    incoming = frame.get("diagnostics", {})
    if isinstance(incoming, dict):
        for key, value in list(incoming.items())[:32]:
            if (isinstance(key, str) and len(key) <= 64 and key not in diagnostics
                    and (value is None or isinstance(value, bool)
                         or (isinstance(value, str) and len(value) <= 1000) or finite(value))):
                diagnostics[key] = value
    return {"source": "hardware", "readings": clean, "diagnostics": diagnostics}


class FrameReader:
    """Bounded line buffer handles split UTF-8/CRLF and noisy boot messages."""
    def __init__(self, limit=32768):
        self.limit = limit
        self.buffer = bytearray()
        self.discarding = False

    def feed(self, chunk):
        frames = []
        for byte in chunk:
            if byte == 10:
                if not self.discarding:
                    frame = telemetry_frame(bytes(self.buffer).rstrip(b"\r"))
                    if frame is not None:
                        frames.append(frame)
                self.buffer.clear()
                self.discarding = False
            elif not self.discarding:
                self.buffer.append(byte)
                if len(self.buffer) > self.limit:
                    self.buffer.clear()
                    self.discarding = True
        return frames


class LatestDelivery:
    """Keep one recent batch during outages; no stale replay or growing queue."""
    def __init__(self, config, request=post_json, clock=time.monotonic):
        self.config, self.request, self.clock = config, request, clock
        self.latest = None
        self.next_attempt = 0
        self.backoff = 1

    def offer(self, frame):
        self.latest = (self.clock(), frame)

    def clear(self):
        self.latest = None

    def tick(self):
        if self.latest is None:
            return None
        now = self.clock()
        captured, frame = self.latest
        if now - captured > 8:
            self.clear()
            return None
        if now < self.next_attempt:
            return None
        try:
            result = self.request(self.config["server"], "/api/device/ingest", frame, self.config["token"])
            if result.get("ok") is not True:
                raise DeliveryError(502)
        except DeliveryError as error:
            if error.status in (401, 403):
                raise
            if 400 <= error.status < 500 and error.status not in (408, 429):
                self.clear()
            self.next_attempt = now + self.backoff
            self.backoff = min(self.backoff * 2, 30)
            return "retry"
        self.clear()
        self.next_attempt, self.backoff = now + 1, 1
        return "sent"


def run_bridge(config):
    try:
        import serial
    except ImportError:
        print("Instala el puerto USB en esta Pi: sudo apt install python3-serial", file=sys.stderr)
        return 2
    delivery = LatestDelivery(config)
    last_message = None
    while True:
        delivery.clear()
        try:
            # Only one process owns this USB port. Firmware is already installed.
            with serial.Serial(config["port"], 115200, timeout=0.5, exclusive=True) as port:
                print("Arduino USB conectado. Esperando las lecturas de tu estación…", flush=True)
                time.sleep(2)  # Opening Uno's serial port may reset its sketch.
                port.reset_input_buffer()
                reader = FrameReader()
                while True:
                    data = port.read(min(max(port.in_waiting, 1), 65536))
                    for frame in reader.feed(data):
                        delivery.offer(frame)
                    state = delivery.tick()
                    if state and state != last_message:
                        print("Lecturas publicadas en Mi planta." if state == "sent" else "Sin conexión al servidor. Reintentando con las lecturas más recientes…", flush=True)
                        last_message = state
        except DeliveryError as error:
            if error.status in (401, 403):
                print("La vinculación fue revocada. Genera un código nuevo en Ajustes → Raspberry Pi 3 / 4.", file=sys.stderr)
                return 3
            raise
        except (serial.SerialException, OSError):
            delivery.clear()
            print("No se puede abrir Arduino USB. Cierra el monitor del navegador, revisa el puerto y vuelve a conectar. Reintentando en 3 s…", flush=True)
            time.sleep(3)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Raspberry Pi 3/4: Arduino USB → Mi planta, sin navegador abierto.")
    parser.add_argument("--server", help="Dirección HTTPS del taller")
    parser.add_argument("--pair", help="Código de un uso generado en Ajustes")
    parser.add_argument("--port", help="Puerto Arduino: /dev/ttyACM0 o /dev/ttyUSB0")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Configuración privada local")
    args = parser.parse_args(argv)
    try:
        if args.pair:
            if not args.server or not args.port:
                raise ValueError("La primera conexión necesita --server, --pair y --port.")
            config = pair_device(args.server, args.pair, args.port)
            save_config(args.config, config)
            print("Raspberry Pi vinculada a tu grupo. Configuración guardada en esta Pi.")
        else:
            with args.config.open(encoding="utf-8") as file:
                config = validate_config(json.load(file))
            if args.server and server_origin(args.server) != config["server"]:
                raise ValueError("Para cambiar de servidor, vincula de nuevo con --pair.")
            if args.port:
                config = validate_config({**config, "port": args.port})
        return run_bridge(config)
    except DeliveryError as error:
        print("El código ya se usó o venció. Genera uno nuevo en Ajustes." if error.status == 401 else "No se pudo vincular al servidor. Revisa la conexión de la Pi y vuelve a intentar.", file=sys.stderr)
        return 3
    except (OSError, ValueError):
        print("Revisa el comando, el puerto y la configuración. Para la primera conexión, genera un código en Ajustes → Raspberry Pi 3 / 4.", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Puente detenido. El puerto USB quedó libre.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
