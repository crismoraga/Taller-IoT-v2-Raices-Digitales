"""Linux bridge behaviour with serial/network peers, not physical Pi hardware."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "firmware" / "raspberry-pi" / "bridge.py"
spec = importlib.util.spec_from_file_location("raspberry_pi_bridge", SOURCE)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)

CONFIG = {"server": "https://taller.example.org", "port": "/dev/ttyACM0",
          "deviceId": "72b726e5-5570-42b8-b14e-576bf418a330", "token": "t" * 43}
READING = {"sensor": "air_temperature", "value": 23, "unit": "°C", "status": "READING"}


def frame(readings=None, **other):
    return json.dumps({"readings": readings if readings is not None else [READING], **other}, ensure_ascii=False).encode()


class RaspberryPiBridgeTests(unittest.TestCase):
    def test_origin_rejects_unverified_http_credentials_paths_and_header_injection(self):
        for value in ("http://server", "https://user:pw@server", "https://server/api",
                      "https://server?token=secret", "https://server#hash", "https://server:0",
                      "https://server\r\nX: leak", None, {}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                bridge.server_origin(value)
        self.assertEqual(bridge.server_origin("https://server:8443/"), "https://server:8443")

    def test_pairing_consumes_only_a_valid_code_after_validating_the_usb_port(self):
        calls = []
        def request(*args):
            calls.append(args)
            return CONFIG
        config = bridge.pair_device(CONFIG["server"], "abcdef012345", "/dev/ttyUSB0", request)
        self.assertEqual(config["port"], "/dev/ttyUSB0")
        self.assertEqual(calls, [(CONFIG["server"], "/api/device/pair", {"code": "ABCDEF012345"})])
        for code, port in (("invalid", "/dev/ttyACM0"), ("abcdef012345", "COM2"), ("abcdef012345", "/dev/ttyACM0\n")):
            with self.assertRaises(ValueError):
                bridge.pair_device(CONFIG["server"], code, port, request)
        self.assertEqual(len(calls), 1)

    def test_configuration_is_atomic_private_and_can_be_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "group" / "config.json"
            bridge.save_config(path, CONFIG)
            self.assertEqual(json.loads(path.read_text()), CONFIG)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            path.chmod(0o644)
            bridge.save_config(path, {**CONFIG, "port": "/dev/ttyUSB0"})
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(json.loads(path.read_text())["port"], "/dev/ttyUSB0")
            self.assertFalse(path.with_name("config.json.new").exists())

    def test_local_configuration_rejects_malformed_device_tokens(self):
        for key, value in (("token", "secret\r\nX: header"), ("token", "short"),
                           ("deviceId", "other"), ("port", "")):
            with self.assertRaises(ValueError):
                bridge.validate_config({**CONFIG, key: value})

    def test_headers_use_the_bearer_token_and_verified_https_default(self):
        captured = []
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b'{"ok":true}'
        class Opener:
            def open(self, request, timeout):
                captured.append((request, timeout))
                return Response()
        result = bridge.post_json(CONFIG["server"], "/api/device/ingest", {"readings": [READING]}, CONFIG["token"], Opener())
        request, timeout = captured[0]
        self.assertEqual(result, {"ok": True})
        self.assertEqual(request.full_url, "https://taller.example.org/api/device/ingest")
        self.assertEqual(request.get_header("Authorization"), "Bearer " + CONFIG["token"])
        self.assertEqual(json.loads(request.data)["readings"][0]["unit"], "°C")
        self.assertEqual(timeout, 5)
        self.assertIsNone(bridge.NoRedirect().redirect_request(request, None, 302, "Moved", {}, "https://other.example.org"))

    def test_http_errors_do_not_echo_server_body_or_device_credentials(self):
        class Opener:
            def open(self, request, timeout):
                raise bridge.urllib.error.HTTPError(request.full_url, 401, CONFIG["token"], {}, io.BytesIO(CONFIG["token"].encode()))
        with self.assertRaises(bridge.DeliveryError) as caught:
            bridge.post_json(CONFIG["server"], "/api/device/ingest", {}, CONFIG["token"], Opener())
        self.assertEqual(caught.exception.status, 401)
        self.assertNotIn(CONFIG["token"], str(caught.exception))

    def test_serial_frames_preserve_real_values_error_states_raw_and_units(self):
        readings = [READING, {"sensor": "soil", "value": None, "unit": "%", "status": "NEEDS_CALIBRATION", "raw": 642},
                    {"sensor": "soil_temperature", "value": None, "unit": "°C", "status": "NO_RESPONSE", "error": "CRC"}]
        parsed = bridge.telemetry_frame(frame(readings, diagnostics={"usb": True}))
        self.assertEqual(parsed["readings"], readings)
        self.assertEqual(parsed["source"], "hardware")
        self.assertEqual(parsed["diagnostics"]["usb"], True)
        self.assertEqual(parsed["diagnostics"]["baudRate"], 115200)

    def test_an_individual_sensor_lesson_is_forwarded_without_invented_channels(self):
        parsed = bridge.telemetry_frame(json.dumps(READING))
        self.assertEqual(parsed["readings"], [READING])
        self.assertEqual(len(parsed["readings"]), 1)

    def test_bad_frames_are_ignored_without_crashing_or_fabricating_values(self):
        invalid = [b"", b"\r", b"Compilando...", b"\xff", b"[]", b"{}", b"null",
                   frame([]), frame([READING, READING]), frame([{**READING, "value": None}]),
                   frame([{**READING, "value": True}]), frame([{**READING, "value": float("nan")}]),
                   frame([{**READING, "value": float("inf")}]), frame([{**READING, "unit": "K"}]),
                   frame([{**READING, "status": []}]), frame([{**READING, "sensor": {}}]),
                   frame([{**READING, "raw": "512"}]), frame([{**READING, "error": "x" * 501}]),
                   frame([{**READING, "sensor": "adc_fake"}]), frame([{**READING, "raw": 10 ** 1000}]),
                   b"[" * 2000 + b"]" * 2000]
        for line in invalid:
            with self.subTest(line=line):
                self.assertIsNone(bridge.telemetry_frame(line))

    def test_utf8_and_crlf_can_arrive_in_arbitrary_usb_fragments(self):
        reader = bridge.FrameReader()
        encoded = frame() + b"\r\n"
        output = []
        for byte in b"\r\nBootloader listo\n" + encoded:
            output.extend(reader.feed(bytes([byte])))
        self.assertEqual(len(output), 1)
        self.assertEqual(output[0]["readings"], [READING])
        self.assertEqual(len(reader.buffer), 0)

    def test_oversized_or_unterminated_usb_noise_is_bounded_and_recovers(self):
        reader = bridge.FrameReader(limit=300)
        self.assertEqual(reader.feed(b"x" * 100000), [])
        self.assertEqual(len(reader.buffer), 0)
        self.assertTrue(reader.discarding)
        output = reader.feed(b"\n" + frame() + b"\n")
        self.assertEqual(len(output), 1)
        self.assertFalse(reader.discarding)

    def test_nested_diagnostics_and_fake_host_metadata_are_not_forwarded(self):
        parsed = bridge.telemetry_frame(frame(diagnostics={"host": "fake", "bad": {"token": "x"}, "nan": float("nan"), "error": "x" * 1001}))
        self.assertEqual(parsed["diagnostics"], {"host": "Raspberry Pi OS", "transport": "Arduino USB", "baudRate": 115200})

    def test_network_backoff_retains_only_latest_real_batch_and_is_bounded(self):
        now, calls, offline = [0], [], [True]
        def request(*args):
            calls.append(args)
            if offline[0]: raise bridge.DeliveryError(503)
            return {"ok": True}
        delivery = bridge.LatestDelivery(CONFIG, request, lambda: now[0])
        for moment in range(80):
            now[0] = moment
            delivery.offer({"source": "hardware", "readings": [{**READING, "value": moment}]})
            delivery.tick()
            self.assertLessEqual(delivery.backoff, 30)
            self.assertIsNotNone(delivery.latest)
        self.assertLess(len(calls), 10)
        offline[0], now[0] = False, 111
        delivery.offer({"source": "hardware", "readings": [{**READING, "value": 111}]})
        self.assertEqual(delivery.tick(), "sent")
        self.assertEqual(calls[-1][2]["readings"][0]["value"], 111)
        self.assertIsNone(delivery.latest)

    def test_old_readings_are_never_replayed_after_an_outage_or_disconnect(self):
        now, calls = [0], []
        delivery = bridge.LatestDelivery(CONFIG, lambda *args: calls.append(args), lambda: now[0])
        delivery.offer({"readings": [READING]})
        now[0] = 9
        self.assertIsNone(delivery.tick())
        self.assertEqual(calls, [])
        delivery.offer({"readings": [READING]})
        delivery.clear()
        self.assertIsNone(delivery.tick())
        self.assertEqual(calls, [])

    def test_revoke_stops_retry_and_malformed_payload_is_dropped(self):
        for status in (401, 403, 400, 422):
            def request(*args): raise bridge.DeliveryError(status)
            delivery = bridge.LatestDelivery(CONFIG, request, lambda: 0)
            delivery.offer({"readings": [READING]})
            if status in (401, 403):
                with self.assertRaises(bridge.DeliveryError): delivery.tick()
            else:
                self.assertEqual(delivery.tick(), "retry")
                self.assertIsNone(delivery.latest)

    def test_usb_reconnect_closes_previous_port_clears_stale_data_and_uses_115200(self):
        calls, ports, sleep_calls = [], [], []
        class SerialError(OSError): pass
        class Port:
            in_waiting = 0
            def __enter__(self): return self
            def __exit__(self, *args): self.closed = True
            def reset_input_buffer(self): pass
            def read(self, limit):
                if len(ports) == 1: raise SerialError("USB gone")
                raise KeyboardInterrupt()
        def serial_open(*args, **kwargs):
            calls.append((args, kwargs))
            port = Port()
            port.closed = False
            ports.append(port)
            return port
        fake = types.SimpleNamespace(Serial=serial_open, SerialException=SerialError)
        with patch.dict(sys.modules, {"serial": fake}), patch.object(bridge.time, "sleep", sleep_calls.append), contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt): bridge.run_bridge(CONFIG)
        self.assertEqual(len(ports), 2)
        self.assertTrue(all(port.closed for port in ports))
        self.assertEqual(calls[0], (("/dev/ttyACM0", 115200), {"timeout": 0.5, "exclusive": True}))
        self.assertEqual(sleep_calls, [2, 3, 2])


if __name__ == "__main__":
    unittest.main()
