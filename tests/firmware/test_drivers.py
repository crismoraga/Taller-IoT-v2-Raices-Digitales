"""Host tests with mocked I/O. These are NOT electrical or timing validation."""
import importlib
import sys
import pathlib
import types
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "firmware"))
import time
time.ticks_ms = lambda: 100000
time.ticks_diff = lambda a, b: a - b
time.ticks_add = lambda a, b: a + b
time.sleep_us = lambda _: None


class Pin:
    IN, OUT, PULL_UP, PULL_DOWN = 0, 1, 2, 3
    def __init__(self, number, mode=None, pull=None, value=0):
        self.number, self.current = number, value
    def value(self, value=None):
        if value is not None:
            self.current = value
        return self.current


class ADC:
    raw = 30000
    def __init__(self, number):
        self.number = number
    def read_u16(self):
        return self.raw


class BrokenDHT:
    def __init__(self, pin):
        pass
    def measure(self):
        raise OSError("checksum")


machine = types.ModuleType("machine")
machine.Pin, machine.ADC = Pin, ADC
machine.time_pulse_us = lambda *args: -2
sys.modules["machine"] = machine
sys.modules["dht"] = types.SimpleNamespace(DHT11=BrokenDHT)
drivers = importlib.import_module("drivers")


class DriverTests(unittest.TestCase):
    def setUp(self):
        ADC.raw = 30000

    def test_soil_requires_physical_calibration(self):
        row = drivers.AnalogSensor("soil").read()[0]
        self.assertEqual(row["status"], "NEEDS_CALIBRATION")
        self.assertIsNone(row["value"])
        self.assertEqual(row["raw"], 30000)

    def test_calibration_works_for_both_voltage_directions(self):
        for endpoints in ({"dry": 45000, "wet": 15000}, {"dry": 15000, "wet": 45000}):
            row = drivers.AnalogSensor("soil", endpoints).read()[0]
            self.assertEqual(row["value"], 50)
            self.assertEqual(row["status"], "READING")

    def test_rail_does_not_claim_disconnected_sensor(self):
        ADC.raw = 65535
        row = drivers.AnalogSensor("soil", {"dry": 45000, "wet": 15000}).read()[0]
        self.assertEqual(row["status"], "UNVERIFIED")
        self.assertIsNone(row["value"])

    def test_out_of_range_calibration_and_degenerate_endpoints(self):
        ADC.raw = 60000
        row = drivers.AnalogSensor("water_level", {"dry": 15000, "wet": 45000}).read()[0]
        self.assertEqual(row["status"], "OUT_OF_RANGE")
        self.assertEqual(row["value"], 100)
        row = drivers.AnalogSensor("water_level", {"dry": 30000, "wet": 30001}).read()[0]
        self.assertEqual(row["status"], "NEEDS_CALIBRATION")

    def test_missing_echo_is_bounded_and_reported(self):
        row = drivers.DistanceSensor().read()[0]
        self.assertEqual(row["status"], "NO_RESPONSE")
        self.assertIsNone(row["value"])

    def test_failed_dht_does_not_hide_other_readings(self):
        registry = drivers.DriverRegistry({"enabled": {"soil": True, "dht11": True}, "calibration": {"soil": {"dry": 45000, "wet": 15000}}})
        rows = {row["sensor"]: row for row in registry.read_all()}
        self.assertEqual(rows["soil"]["status"], "READING")
        self.assertEqual(rows["air_temperature"]["status"], "NO_RESPONSE")
        self.assertEqual(rows["air_humidity"]["status"], "NO_RESPONSE")
        self.assertEqual(rows["water_level"]["status"], "DISABLED")

    def test_no_enabled_config_never_reads_floating_pins(self):
        registry = drivers.DriverRegistry({})
        self.assertEqual(registry.drivers, {})
        self.assertTrue(all(row["status"] == "DISABLED" for row in registry.read_all()))

    def test_light_is_relative_never_lux(self):
        row = drivers.AnalogSensor("light").read()[0]
        self.assertEqual(row["unit"], "%")
        self.assertIn("no mide lux", row["confidence"])


if __name__ == "__main__":
    unittest.main()
