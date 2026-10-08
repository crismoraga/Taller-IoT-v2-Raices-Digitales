"""Bounded HTTPS, verified CA + hostname, Wi-Fi reconnection without secrets in logs."""
try:
    import network
except ImportError:
    network = None
try:
    import socket
except ImportError:
    socket = None
try:
    import ssl
except ImportError:
    ssl = None
import time
import machine
import json
import ubinascii
import struct


def parse_endpoint(url):
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError("Telemetría requiere un endpoint HTTPS")
    rest = url[8:]
    authority, _, path = rest.partition("/")
    if "@" in authority or "\r" in url or "\n" in url or "?" in authority or "#" in url:
        raise ValueError("Endpoint inválido")
    parts = authority.split(":")
    if len(parts) > 2 or not parts[0]:
        raise ValueError("Usa hostname DNS o IPv4 en el endpoint")
    port = int(parts[1]) if len(parts) == 2 else 443
    if not 1 <= port <= 65535:
        raise ValueError("Puerto inválido")
    return parts[0], port, "/" + path, authority


class Cloud:
    def __init__(self, config):
        self.config = config
        self.wlan = network.WLAN(network.STA_IF) if network and hasattr(network, "WLAN") else None
        if self.wlan:
            self.wlan.active(True)
        self.next_attempt = time.ticks_ms()
        self.connect_started = None
        self.backoff = 1000
        self.next_publish = time.ticks_ms()
        self.state = "Sin configuración Wi-Fi" if self.wlan else "Placa sin Wi-Fi; usa puente USB"
        self.last_error = None
        self.clock_valid = False
        self.address = None
        self.context = None
        self.last_verified = False
        rtc = config.get("rtc")
        if isinstance(rtc, list) and len(rtc) == 6 and 2024 <= rtc[0] <= 2099:
            machine.RTC().datetime((rtc[0], rtc[1], rtc[2], 0, rtc[3], rtc[4], rtc[5], 0))
            self.clock_valid = True

    def diagnostic(self):
        return {"wifi": self.state, "cloudError": self.last_error,
                "ip": self.wlan.ifconfig()[0] if self.wlan and self.wlan.isconnected() else None,
                "tlsVerified": bool(self.last_verified and self.wlan and self.wlan.isconnected() and not self.last_error),
                "clockValid": self.clock_valid,
                "deviceId": self.config.get("deviceId"), "firmware": "1.0.0"}

    def tick(self):
        if not self.wlan or not self.config.get("ssid"):
            return False
        now = time.ticks_ms()
        if self.wlan.isconnected():
            self.state = "Conectado (2.4 GHz)"
            self.backoff = 1000
            self.connect_started = None
            return True
        self.state = "Sin conexión; USB sigue operativo"
        if self.connect_started is not None:
            if time.ticks_diff(now, self.connect_started) < 12000 and self.wlan.status() >= 0:
                return False
            self.wlan.disconnect()
            self.connect_started = None
            self.next_attempt = time.ticks_add(now, self.backoff)
            self.backoff = min(60000, self.backoff * 2)
        elif time.ticks_diff(now, self.next_attempt) >= 0:
            try:
                self.wlan.connect(self.config["ssid"], self.config.get("password", ""))
                self.connect_started = now
                self.state = "Conectando a Wi-Fi 2.4 GHz"
            except Exception:
                self.next_attempt = time.ticks_add(now, self.backoff)
                self.backoff = min(60000, self.backoff * 2)
        return False

    def set_clock(self):
        # Use the browser-supplied UTC RTC first; bounded UDP NTP is a fallback.
        if self.clock_valid:
            return
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(2)
        try:
            query = bytearray(48)
            query[0] = 0x23
            address = socket.getaddrinfo(self.config.get("ntpHost", "pool.ntp.org"), 123)[0][-1]
            sock.sendto(query, address)
            packet = sock.recv(48)
            if len(packet) != 48 or (packet[0] & 7) != 4 or (packet[0] >> 6) == 3 or not 1 <= packet[1] <= 15:
                raise OSError("Respuesta NTP inválida")
            seconds = struct.unpack("!I", packet[40:44])[0]
            epoch = 2208988800 if time.gmtime(0)[0] == 1970 else 3155673600
            date = time.gmtime(seconds - epoch)
            machine.RTC().datetime((date[0], date[1], date[2], date[6], date[3], date[4], date[5], 0))
            self.clock_valid = date[0] >= 2024
        finally:
            sock.close()

    def tls_context(self):
        if self.context is not None:
            return self.context
        if not self.clock_valid:
            raise OSError("Ajusta fecha UTC de la Pico para verificar certificados")
        if not ssl or not hasattr(ssl, "SSLContext") or not hasattr(ssl, "CERT_REQUIRED"):
            raise OSError("Este MicroPython no admite TLS verificado; actualiza firmware")
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.verify_mode = ssl.CERT_REQUIRED
        # A single DER certificate works on released MicroPython mbedTLS ports.
        with open(self.config.get("caFile", "ca.pem"), "r") as ca:
            pem = ca.read()
        content = pem.split("-----BEGIN CERTIFICATE-----")[1].split("-----END CERTIFICATE-----")[0]
        certificate = ubinascii.a2b_base64(content.replace("\n", "").replace("\r", ""))
        context.load_verify_locations(cadata=certificate)
        self.context = context
        return context

    def publish(self, readings):
        now = time.ticks_ms()
        if not self.wlan or not self.wlan.isconnected() or time.ticks_diff(now, self.next_publish) < 0:
            return
        self.next_publish = time.ticks_add(now, 5000)
        if not self.config.get("endpoint") or not self.config.get("token"):
            self.last_error = "Vincula la estación para habilitar telemetría"
            return
        sock = None
        tls = None
        self.last_verified = False
        try:
            host, port, path, authority = parse_endpoint(self.config["endpoint"])
            token = self.config["token"]
            if "\r" in token or "\n" in token:
                raise ValueError("Token inválido")
            self.set_clock()
            context = self.tls_context()
            if self.address is None:
                self.address = socket.getaddrinfo(host, port, 0, socket.SOCK_STREAM)[0][-1]
            sock = socket.socket()
            sock.settimeout(3)
            sock.connect(self.address)
            tls = context.wrap_socket(sock, server_hostname=host)
            self.last_verified = True
            body = json.dumps({"readings": readings, "source": "hardware", "diagnostics": self.diagnostic()}).encode()
            headers = ("POST %s HTTP/1.1\r\nHost: %s\r\nAuthorization: Bearer %s\r\n"
                       "Content-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n") % (path, authority, token, len(body))
            packet = headers.encode() + body
            offset = 0
            deadline = time.ticks_add(time.ticks_ms(), 6000)
            while offset < len(packet):
                if time.ticks_diff(time.ticks_ms(), deadline) >= 0:
                    raise OSError("Tiempo de envío agotado")
                sent = tls.write(packet[offset:offset + 1024])
                if not sent:
                    raise OSError("Conexión cerrada durante envío")
                offset += sent
            # Only need the status line: never allocate an unbounded HTTP body.
            response = bytearray()
            while len(response) < 256 and not response.endswith(b"\r\n"):
                if time.ticks_diff(time.ticks_ms(), deadline) >= 0:
                    raise OSError("Tiempo de respuesta agotado")
                byte = tls.read(1)
                if not byte:
                    raise OSError("Respuesta HTTPS truncada")
                response.extend(byte)
            status = bytes(response).split(b" ")
            if len(status) < 2 or status[1] not in (b"200", b"201", b"202", b"204"):
                raise OSError("HTTP %s; revisa token y servidor" % (status[1].decode() if len(status) > 1 else "inválido"))
            self.last_error = None
        except Exception as error:
            # Errors never print config, credentials, headers or the payload.
            self.last_error = str(error)[:140]
            self.address = None
            self.next_publish = time.ticks_add(time.ticks_ms(), 15000)
        finally:
            if tls:
                tls.close()
            elif sock:
                sock.close()
