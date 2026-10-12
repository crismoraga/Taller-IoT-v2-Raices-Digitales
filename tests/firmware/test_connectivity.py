"""Security and offline behaviour using fake sockets, not physical Wi-Fi."""
import importlib
import pathlib
import sys
import types
import binascii
import ssl
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "firmware"))


class WLAN:
    connected = False
    def __init__(self):
        self.attempts = 0
    def active(self, enabled):
        pass
    def connect(self, ssid, password):
        self.attempts += 1
    def disconnect(self):
        self.connected = False
    def isconnected(self):
        return self.connected
    def ifconfig(self):
        return ("192.0.2.2", "", "", "")
    def status(self):
        return 1


class RTC:
    def datetime(self, value):
        self.value = value


sys.modules.setdefault("network", types.SimpleNamespace(STA_IF=0, WLAN=lambda _: WLAN()))
sys.modules.setdefault("ubinascii", binascii)
sys.modules.setdefault("machine", types.SimpleNamespace(RTC=RTC))
connectivity = importlib.import_module("connectivity")


class ConnectionTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.patches = [patch.object(connectivity.time, "ticks_ms", lambda: self.now, create=True),
                        patch.object(connectivity.time, "ticks_add", lambda a, b: a + b, create=True),
                        patch.object(connectivity.time, "ticks_diff", lambda a, b: a - b, create=True),
                        patch.object(connectivity, "machine", types.SimpleNamespace(RTC=RTC))]
        for item in self.patches:
            item.start()
        self.config = {"ssid": "workshop", "password": "private", "token": "secret-device-token",
                       "endpoint": "https://station.example.org/api/device/ingest",
                       "rtc": [2026, 10, 7, 15, 0, 0],
                       "caFile": str(pathlib.Path(__file__).resolve().parents[2] / "firmware" / "ca.pem")}

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()

    def test_https_only_and_header_injection_rejection(self):
        for endpoint in ("http://server/api", "https://user:pw@server/api", "https://server/api\r\nX: y", "https://server:0/api"):
            with self.assertRaises((ValueError, TypeError)):
                connectivity.parse_endpoint(endpoint)
        self.assertEqual(connectivity.parse_endpoint("https://server:8443/api"), ("server", 8443, "/api", "server:8443"))

    def test_wifi_timeout_retries_without_waiting_or_sending(self):
        cloud = connectivity.Cloud(self.config)
        self.assertFalse(cloud.tick())
        self.assertEqual(cloud.wlan.attempts, 1)
        self.now = 12001
        self.assertFalse(cloud.tick())
        self.assertEqual(cloud.backoff, 2000)
        self.now = 13002
        cloud.tick()
        self.assertEqual(cloud.wlan.attempts, 2)
        cloud.publish([])
        self.assertIsNone(cloud.context)
        self.assertNotIn("private", str(cloud.diagnostic()))
        self.assertNotIn("secret-device-token", str(cloud.diagnostic()))

    def test_clock_and_cert_required_fail_closed(self):
        cloud = connectivity.Cloud(self.config)
        cloud.clock_valid = False
        with self.assertRaisesRegex(OSError, "fecha"):
            cloud.tls_context()
        cloud.clock_valid = True
        context = cloud.tls_context()
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertGreaterEqual(context.cert_store_stats()["x509_ca"], 1)
        self.assertFalse(cloud.diagnostic()["tlsVerified"])

    def test_plain_pico_can_measure_without_network_module(self):
        with patch.object(connectivity, "network", None):
            cloud = connectivity.Cloud({})
            self.assertFalse(cloud.tick())
            cloud.publish([])
            self.assertIn("sin Wi-Fi", cloud.diagnostic()["wifi"])

    def test_wifi_initialization_or_interface_failure_does_not_stop_usb(self):
        def unavailable(_):
            raise OSError("chip unavailable")
        with patch.object(connectivity, "network", types.SimpleNamespace(STA_IF=0, WLAN=unavailable)):
            cloud = connectivity.Cloud(self.config)
            self.assertFalse(cloud.tick())
            cloud.publish([])
            self.assertIn("USB", cloud.diagnostic()["cloudError"])
        cloud = connectivity.Cloud(self.config)
        cloud.wlan.isconnected = lambda: (_ for _ in ()).throw(OSError("wifi driver"))
        self.assertFalse(cloud.tick())
        cloud.publish([])
        self.assertIsNone(cloud.diagnostic()["ip"])
        self.assertFalse(cloud.diagnostic()["tlsVerified"])
        cloud.wlan.isconnected = lambda: True
        cloud.wlan.ifconfig = lambda: (_ for _ in ()).throw(OSError("interface changing"))
        self.assertIsNone(cloud.diagnostic()["ip"])

    def test_invalid_or_unavailable_rtc_leaves_usb_and_ntp_fallback_available(self):
        for rtc in (["2026", 10, 7, 15, 0, 0], [2026, 2, 29, 15, 0, 0],
                    [2026, 13, 7, 15, 0, 0], [2026, 10, 7, 24, 0, 0],
                    [True, 10, 7, 15, 0, 0], None):
            self.config["rtc"] = rtc
            cloud = connectivity.Cloud(self.config)
            self.assertFalse(cloud.clock_valid)
            self.assertIsInstance(cloud.diagnostic(), dict)
        class BrokenRTC:
            def datetime(self, value):
                raise OSError("rtc unavailable")
        self.config["rtc"] = [2026, 10, 7, 15, 0, 0]
        with patch.object(connectivity, "machine", types.SimpleNamespace(RTC=BrokenRTC)):
            cloud = connectivity.Cloud(self.config)
            self.assertFalse(cloud.clock_valid)
            self.assertIn("USB", cloud.diagnostic()["cloudError"])

    def test_failed_wifi_status_enters_backoff_and_reconnects(self):
        cloud = connectivity.Cloud(self.config)
        cloud.tick()
        cloud.wlan.status = lambda: (_ for _ in ()).throw(OSError("driver reset"))
        self.now = 100
        self.assertFalse(cloud.tick())
        self.assertIsNone(cloud.connect_started)
        self.assertEqual(cloud.backoff, 2000)
        self.now = 1101
        cloud.tick()
        self.assertEqual(cloud.wlan.attempts, 2)

    def test_selected_vercel_certificate_loads_as_a_single_verified_trust_anchor(self):
        self.config["caFile"] = str(pathlib.Path(__file__).resolve().parents[2] / "firmware" / "ca-vercel.pem")
        cloud = connectivity.Cloud(self.config)
        cloud.clock_valid = True
        context = cloud.tls_context()
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertEqual(context.cert_store_stats()["x509_ca"], 1)

    def test_verified_diagnostic_is_false_after_disconnect_or_delivery_failure(self):
        cloud = connectivity.Cloud(self.config)
        cloud.last_verified = True
        cloud.wlan.connected = True
        self.assertIs(cloud.diagnostic()["tlsVerified"], True)
        cloud.wlan.connected = False
        self.assertIs(cloud.diagnostic()["tlsVerified"], False)
        cloud.wlan.connected = True
        cloud.last_error = "HTTP 500; revisa token y servidor"
        self.assertIs(cloud.diagnostic()["tlsVerified"], False)

    def test_verified_https_uses_bearer_and_closes_socket(self):
        class Raw:
            closed = False
            def settimeout(self, value):
                self.timeout = value
            def connect(self, address):
                self.address = address
            def close(self):
                self.closed = True
        class TLS:
            response = b"HTTP/1.1 200 OK\r\n"
            payload = b""
            closed = False
            def write(self, value):
                self.payload += value
                return len(value)
            def read(self, count):
                value, self.response = self.response[:count], self.response[count:]
                return value
            def close(self):
                self.closed = True
        raw, tls = Raw(), TLS()
        hostname = []
        context = types.SimpleNamespace(wrap_socket=lambda sock, server_hostname: hostname.append(server_hostname) or tls)
        cloud = connectivity.Cloud(self.config)
        cloud.wlan.connected = True
        with patch.object(cloud, "tls_context", return_value=context), \
             patch.object(connectivity.socket, "socket", return_value=raw), \
             patch.object(connectivity.socket, "getaddrinfo", return_value=[(0, 0, 0, "", ("192.0.2.1", 443))]):
            cloud.publish([{"sensor": "soil", "value": 50, "status": "READING", "unit": "%"}])
        self.assertEqual(hostname, ["station.example.org"])
        self.assertIn(b"Authorization: Bearer secret-device-token\r\n", tls.payload)
        self.assertIn(b'"source": "hardware"', tls.payload)
        self.assertTrue(tls.closed)
        self.assertEqual(raw.timeout, 3)
        self.assertTrue(cloud.last_verified)

    def test_fragmented_write_and_response_and_failed_close_keep_sampling_available(self):
        class Raw:
            def settimeout(self, value): pass
            def connect(self, address): pass
            def close(self): raise OSError("close error")
        class TLS:
            payload = b""
            response = b"HTTP/1.1 202 Accepted\r\n"
            def write(self, value):
                self.payload += value[:3]
                return min(3, len(value))
            def read(self, count):
                value, self.response = self.response[:1], self.response[1:]
                return value
            def close(self): raise OSError("close error")
        raw, tls = Raw(), TLS()
        context = types.SimpleNamespace(wrap_socket=lambda *args, **kwargs: tls)
        cloud = connectivity.Cloud(self.config)
        cloud.wlan.connected = True
        with patch.object(cloud, "tls_context", return_value=context), \
             patch.object(connectivity.socket, "socket", return_value=raw), \
             patch.object(connectivity.socket, "getaddrinfo", return_value=[(0, 0, 0, "", ("192.0.2.1", 443))]):
            cloud.publish([])
            self.assertIsNone(cloud.last_error)
            self.assertTrue(cloud.diagnostic()["tlsVerified"])
            self.now = 5000
            tls.response = b"garbage 200 OK\r\n"
            cloud.publish([])
            self.assertIn("HTTP", cloud.last_error)
            self.assertFalse(cloud.diagnostic()["tlsVerified"])
        self.assertIn(b'"readings": []', tls.payload)


if __name__ == "__main__":
    unittest.main()
