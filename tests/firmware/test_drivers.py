"""Host tests with mocked I/O. These are NOT electrical or timing validation."""
import importlib
import sys
import pathlib
import types
import unittest
from unittest.mock import patch

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

    def test_malformed_optional_configuration_never_enables_a_floating_pin(self):
        for config in (None, [], {"enabled": None}, {"enabled": []},
                       {"enabled": {"soil": "true", "light": 1}},
                       {"enabled": {"soil": True}, "calibration": None}):
            registry = drivers.DriverRegistry(config)
            rows = {row["sensor"]: row for row in registry.read_all()}
            self.assertEqual(rows["light"]["status"], "DISABLED")
            if isinstance(config, dict) and config.get("enabled") == {"soil": True}:
                self.assertEqual(rows["soil"]["status"], "NEEDS_CALIBRATION")
            else:
                self.assertEqual(rows["soil"]["status"], "DISABLED")

    def test_references_from_another_adc_or_invalid_numbers_are_not_applied(self):
        for calibration in ({"dry": 100, "wet": 800, "board": "uno"},
                            {"dry": 100, "wet": 800},
                            {"dry": -1, "wet": 45000},
                            {"dry": True, "wet": 45000},
                            {"dry": float("nan"), "wet": 45000},
                            {"dry": float("inf"), "wet": 45000},
                            {"dry": 15000.5, "wet": 45000},
                            [], "invalid"):
            row = drivers.AnalogSensor("soil", calibration).read()[0]
            self.assertEqual(row["status"], "NEEDS_CALIBRATION", calibration)
            self.assertIsNone(row["value"])
        ADC.raw = 450
        self.assertEqual(drivers.AnalogSensor("soil", {"dry": 100, "wet": 800, "board": "pico"}).read()[0]["value"], 50)

    def test_individual_dht_flags_override_group_defaults_and_recover_legacy_config(self):
        registry = drivers.DriverRegistry({"enabled": {"dht11": True, "air_temperature": False, "air_humidity": False}})
        self.assertNotIn("dht11", registry.drivers)
        registry = drivers.DriverRegistry({"enabled": {"dht11": False, "air_temperature": True}})
        rows = {row["sensor"]: row for row in registry.read_all()}
        self.assertEqual(rows["air_temperature"]["status"], "NO_RESPONSE")
        self.assertEqual(rows["air_humidity"]["status"], "DISABLED")

    def test_failed_initialization_recovers_without_restarting_healthy_sensors(self):
        class EventuallyDHT:
            attempts = 0
            def __init__(self):
                EventuallyDHT.attempts += 1
                if EventuallyDHT.attempts == 1:
                    raise OSError("module starting")
            def read(self):
                return [drivers.reading("air_temperature", 22, "°C"), drivers.reading("air_humidity", 50, "%")]
        now = [100000]
        with patch.object(drivers, "DHTSensor", EventuallyDHT), patch.object(drivers.time, "ticks_ms", lambda: now[0]):
            registry = drivers.DriverRegistry({"enabled": {"light": True, "dht11": True}})
            healthy = registry.drivers["light"]
            self.assertEqual({row["sensor"]: row for row in registry.read_all()}["air_temperature"]["status"], "NO_RESPONSE")
            registry.start_conversion()
            self.assertEqual(EventuallyDHT.attempts, 1)
            now[0] += 2000
            registry.start_conversion()
            rows = {row["sensor"]: row for row in registry.read_all()}
            self.assertEqual(rows["air_temperature"]["value"], 22)
            self.assertIs(registry.drivers["light"], healthy)
            self.assertEqual(EventuallyDHT.attempts, 2)

    def test_ds18b20_waits_for_conversion_validates_rom_and_rediscovers(self):
        class Device:
            def __init__(self, wire):
                self.ow = types.SimpleNamespace(crc8=lambda rom: 0 if rom[-1] == 1 else 1)
                self.roms = [bytes([0x28, 0, 0, 0, 0, 0, 0, 1])]
                self.conversions = 0
            def scan(self):
                return self.roms
            def convert_temp(self):
                self.conversions += 1
            def read_temp(self, rom):
                return 23.5
        now = [100000]
        with patch.dict(sys.modules, {"onewire": types.SimpleNamespace(OneWire=lambda pin: object()),
                                      "ds18x20": types.SimpleNamespace(DS18X20=Device)}), \
             patch.object(drivers.time, "ticks_ms", lambda: now[0]):
            sensor = drivers.SoilTemperatureSensor()
            sensor.start()
            self.assertEqual(sensor.read()[0]["status"], "UNVERIFIED")
            now[0] += 750
            self.assertEqual(sensor.read()[0]["value"], 23.5)
            sensor.device.roms = []
            sensor.start()
            self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
            sensor.device.roms = [bytes([0x28, 0, 0, 0, 0, 0, 0, 0])]
            sensor.start()
            self.assertEqual(sensor.read()[0]["status"], "NO_RESPONSE")
            sensor.device.roms[0] = bytes([0x28, 0, 0, 0, 0, 0, 0, 1])
            sensor.start()
            now[0] += 750
            self.assertEqual(sensor.read()[0]["status"], "READING")
            self.assertEqual(sensor.device.conversions, 2)


if __name__ == "__main__":
    unittest.main()
