"""GPIO checker with library peers and real temporary kernel files, no physical Pi."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import time
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "firmware" / "raspberry-pi" / "check_sensors.py"
spec = importlib.util.spec_from_file_location("raspberry_pi_gpio", SOURCE)
gpio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gpio)


class RaspberryPiGpioTests(unittest.TestCase):
    def test_pin_map_uses_distinct_bcm_and_correct_header_positions(self):
        expected = {"dht11": ((22, 15),), "ds18b20": ((4, 7),),
                    "distance": ((23, 16), (24, 18)), "motion": ((26, 37),), "rain": ((17, 11),)}
        pins = []
        for sensor, pairs in expected.items():
            actual = tuple((item["bcm"], item["physical"]) for item in gpio.PIN_MAP[sensor].values())
            self.assertEqual(actual, pairs)
            pins.extend(item[0] for item in pairs)
        self.assertEqual(len(pins), len(set(pins)))

    def test_dht_uses_linux_pulse_driver_and_reports_two_real_readings(self):
        calls = []
        device = types.SimpleNamespace(temperature=24, humidity=56, exit=lambda: calls.append("closed"))
        module = types.SimpleNamespace(DHT11=lambda *args, **kwargs: calls.append((args, kwargs)) or device)
        sensor = gpio.Dht11(module, types.SimpleNamespace(D22=22))
        self.assertEqual(calls, [((22,), {"use_pulseio": False})])
        rows = sensor.read()
        self.assertEqual([(r["sensor"], r["value"], r["status"]) for r in rows],
                         [("air_temperature", 24, "READING"), ("air_humidity", 56, "READING")])
        sensor.close()
        self.assertEqual(calls[-1], "closed")

    def test_dht_crc_error_null_and_out_of_range_never_become_readings(self):
        class Device:
            @property
            def temperature(self): raise RuntimeError("Checksum did not validate")
        sensor = gpio.Dht11(types.SimpleNamespace(DHT11=lambda *a, **k: Device()), types.SimpleNamespace(D22=22))
        self.assertEqual([(r["status"], r["value"]) for r in sensor.read()], [("NO_RESPONSE", None)] * 2)
        sensor.device = types.SimpleNamespace(temperature=float("nan"), humidity=101)
        rows = sensor.read()
        self.assertEqual(rows[0]["status"], "NO_RESPONSE")
        self.assertEqual(rows[1]["status"], "OUT_OF_RANGE")
        self.assertIsNone(rows[1]["value"])
        self.assertEqual(rows[1]["raw"], 101)

    def write_w1(self, root, temp=23750, crc="YES", device="28-000000123456"):
        directory = Path(root) / device
        directory.mkdir(exist_ok=True)
        (directory / "w1_slave").write_text(f"aa bb cc : crc=11 {crc}\naa bb cc t={temp}\n")
        return directory

    def test_ds_reads_kernel_crc_valid_temperature_and_does_not_guess_absent_sensor(self):
        with tempfile.TemporaryDirectory() as root:
            sensor = gpio.Ds18b20(root)
            self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
            self.write_w1(root)
            row = sensor.read()[0]
            self.assertEqual((row["sensor"], row["value"], row["unit"], row["status"]),
                             ("soil_temperature", 23.75, "°C", "READING"))

    def test_ds_rejects_crc_and_malformed_file_without_stale_temperature(self):
        with tempfile.TemporaryDirectory() as root:
            directory = self.write_w1(root)
            sensor = gpio.Ds18b20(root)
            self.assertEqual(sensor.read()[0]["value"], 23.75)
            self.write_w1(root, crc="NO")
            self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
            (directory / "w1_slave").write_text("crc YES\nnot a temperature\n")
            self.assertEqual(sensor.read()[0]["value"], None)
            (directory / "w1_slave").unlink()
            self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")

    def test_ds_85_power_on_retries_but_accepts_next_crc_valid_conversion(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_w1(root, 85000)
            sensor = gpio.Ds18b20(root)
            self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
            self.assertEqual(sensor.read()[0]["value"], 85)
            self.write_w1(root, -127000)
            self.assertEqual(sensor.read()[0]["status"], "OUT_OF_RANGE")
            self.write_w1(root, -55000)
            self.assertEqual(sensor.read()[0]["value"], -55)

    def test_ds_selects_explicit_device_and_rejects_path_traversal_and_ambiguous_bus(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_w1(root)
            self.write_w1(root, 19500, device="28-000000999999")
            self.assertEqual(gpio.Ds18b20(root).read()[0]["status"], "ERROR")
            self.assertEqual(gpio.Ds18b20(root, "28-000000999999").read()[0]["value"], 19.5)
            self.assertEqual(gpio.Ds18b20(root, "../../etc/passwd").read()[0]["status"], "ERROR")

    def test_optional_dependencies_fail_only_selected_sensor_and_analog_has_no_native_adc(self):
        with patch.object(gpio.importlib, "import_module", side_effect=ImportError("not installed")) as imports:
            sensor = gpio.make_sensor("dht11")
            self.assertEqual([r["status"] for r in sensor.read()], ["ERROR", "ERROR"])
            self.assertEqual(gpio.make_sensor("motion").read()[0]["status"], "ERROR")
            before = imports.call_count
            for selected in gpio.ADC_CHANNELS:
                row = gpio.make_sensor(selected).read()[0]
                self.assertEqual(row["value"], None)
                self.assertEqual(row["status"], "ERROR")
                self.assertIn("MCP3008", row["error"])
            self.assertEqual(imports.call_count, before)

    def test_analog_spi_requires_device_file_and_returns_raw_without_fabricated_percent(self):
        calls = []
        device = types.SimpleNamespace(raw_value=643, close=lambda: calls.append("closed"))
        fake = types.SimpleNamespace(MCP3008=lambda **kwargs: calls.append(kwargs) or device)
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "spidev0.0"
            with patch.object(gpio.importlib, "import_module", return_value=fake) as imports:
                failed = gpio.make_sensor("soil", adc="mcp3008", spi_path=path)
                self.assertEqual(failed.read()[0]["status"], "ERROR")
                imports.assert_not_called()
                path.touch()
                sensor = gpio.make_sensor("soil", adc="mcp3008", spi_path=path)
                self.assertEqual(calls[0], {"channel": 0, "port": 0, "device": 0})
                row = sensor.read()[0]
                self.assertEqual((row["status"], row["value"], row["raw"]), ("NEEDS_CALIBRATION", None, 643))
                device.raw_value = 0
                self.assertEqual(sensor.read()[0]["raw"], 0)
                device.raw_value = float("inf")
                self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
                sensor.close()
                self.assertEqual(calls[-1], "closed")

    def test_digital_pin_reading_uses_correct_active_low_rain_and_high_pir(self):
        calls = []
        devices = []
        def open_pin(pin, **kwargs):
            calls.append((pin, kwargs))
            # gpiozero is_active already accounts for pull-up polarity.
            device = types.SimpleNamespace(is_active=True, close=lambda: calls.append("closed"))
            devices.append(device)
            return device
        module = types.SimpleNamespace(DigitalInputDevice=open_pin)
        rain, motion = gpio.DigitalSensor(module, "rain"), gpio.DigitalSensor(module, "motion")
        self.assertEqual(calls[:2], [(17, {"pull_up": True}), (26, {"pull_up": False})])
        self.assertEqual(rain.read()[0]["value"], 1)
        devices[0].is_active = False
        self.assertEqual(rain.read()[0]["value"], 0)
        self.assertEqual(motion.read()[0]["value"], 1)
        self.assertIn("no identifica presencia", motion.read()[0]["confidence"])
        rain.close()
        motion.close()
        self.assertEqual(calls[-2:], ["closed", "closed"])

    def test_ultrasonic_read_is_bounded_without_echo_and_does_not_access_blocking_distance_property(self):
        calls = []
        now = [100]
        class Distance:
            def __init__(self, **kwargs): calls.append(kwargs)
            def _read(self): return None
            @property
            def distance(self): raise AssertionError("blocking queue property must not be used")
            def close(self): calls.append("closed")
        sensor = gpio.Ultrasonic(types.SimpleNamespace(DistanceSensor=Distance), lambda: now[0])
        self.assertEqual(calls[0], {"echo": 24, "trigger": 23, "max_distance": 4, "queue_len": 1, "partial": True})
        began = time.monotonic()
        self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
        sensor.device._read()
        self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
        self.assertLess(time.monotonic() - began, 0.1)
        sensor.close()
        self.assertEqual(calls[-1], "closed")

    def test_ultrasonic_latest_real_attempt_prevents_old_echo_replay(self):
        now, replies = [1], [0.25, None, 1.0]
        class Distance:
            def __init__(self, **kwargs): pass
            def _read(self): return replies.pop(0)
            def close(self): pass
        sensor = gpio.Ultrasonic(types.SimpleNamespace(DistanceSensor=Distance), lambda: now[0])
        sensor.device._read()
        self.assertEqual(sensor.read()[0]["value"], 100)
        now[0] = 2
        self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
        sensor.device._read()
        self.assertEqual(sensor.read()[0]["value"], None)
        sensor.device._read()
        self.assertEqual(sensor.read()[0]["status"], "OUT_OF_RANGE")

    def test_frame_preserves_errors_and_does_not_replace_with_fake_channels(self):
        failed = gpio.FailedSensor(("air_temperature", "air_humidity"), "Falta biblioteca")
        result = gpio.read_frame([("dht11", failed)])
        self.assertEqual(result["source"], "hardware")
        self.assertEqual(len(result["readings"]), 2)
        self.assertEqual([r["value"] for r in result["readings"]], [None, None])
        self.assertEqual(result["diagnostics"]["transport"], "GPIO / 1-Wire / SPI")
        json.dumps(result, allow_nan=False)

    def test_platform_init_and_individual_read_failures_do_not_hide_other_sensors(self):
        with patch.object(gpio.importlib, "import_module", side_effect=NotImplementedError("No Pi GPIO on host")):
            self.assertEqual(gpio.make_sensor("motion").read()[0]["status"], "ERROR")
        class Broken:
            def read(self): raise OSError("GPIO disconnected")
        class Good:
            def read(self): return [gpio.reading("rain", 1)]
        frame = gpio.read_frame([("motion", Broken()), ("rain", Good())])
        self.assertEqual([(row["sensor"], row["status"]) for row in frame["readings"]],
                         [("motion", "ERROR"), ("rain", "READING")])

    def test_once_deduplicates_selection_emits_single_frame_and_closes_gpio(self):
        calls = []
        class Sensor:
            def read(self): return [gpio.reading("motion", 1)]
            def close(self): calls.append("close")
        def factory(sensor, **kwargs):
            calls.append(sensor)
            return Sensor()
        out = io.StringIO()
        with patch.object(gpio, "make_sensor", factory), contextlib.redirect_stdout(out):
            code = gpio.main(["--sensor", "motion,motion", "--sensor", "motion", "--once"])
        self.assertEqual(code, 0)
        self.assertEqual(calls, ["motion", "close"])
        self.assertEqual(json.loads(out.getvalue())["readings"][0]["value"], 1)
        self.assertEqual(len(out.getvalue().splitlines()), 1)

    def test_loop_waits_two_seconds_and_ctrl_c_closes_all_sensors(self):
        calls = []
        class Sensor:
            def read(self): return [gpio.reading("motion", 0)]
            def close(self): calls.append("closed")
        def sleep(delay):
            calls.append(delay)
            raise KeyboardInterrupt()
        with patch.object(gpio, "make_sensor", return_value=Sensor()), patch.object(gpio.time, "monotonic", side_effect=[10, 10.2]), patch.object(gpio.time, "sleep", sleep), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(gpio.main(["--sensor", "motion"]), 0)
        self.assertAlmostEqual(calls[0], 1.8)
        self.assertEqual(calls[1], "closed")

    def test_once_failure_exit_is_nonzero_and_invalid_sensor_does_not_open_pins(self):
        with patch.object(gpio, "make_sensor", return_value=gpio.FailedSensor(("motion",), "Absent")), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(gpio.main(["--sensor", "motion", "--once"]), 1)
        with patch.object(gpio, "make_sensor") as factory, contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as caught:
            gpio.main(["--sensor", "not-real", "--once"])
        self.assertEqual(caught.exception.code, 2)
        factory.assert_not_called()


if __name__ == "__main__":
    unittest.main()
