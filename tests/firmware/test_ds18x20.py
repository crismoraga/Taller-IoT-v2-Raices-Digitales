"""Native driver calculations with fake 1-Wire I/O; no electrical validation."""
import importlib.util
import pathlib
import sys
import types
import unittest
from unittest.mock import patch


class Wire:
    SKIP_ROM = 0xCC
    def __init__(self, scratch):
        self.scratch = scratch
    def reset(self, required=False): pass
    def select_rom(self, rom): pass
    def writebyte(self, value): pass
    def readinto(self, target):
        target[:] = self.scratch
    def crc8(self, value): return 0


class TemperatureTests(unittest.TestCase):
    def test_unused_resolution_bits_are_ignored_including_negative_temperatures(self):
        source = pathlib.Path(__file__).resolve().parents[2] / "firmware" / "ds18x20.py"
        spec = importlib.util.spec_from_file_location("real_ds18x20_calculations", source)
        driver = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"micropython": types.SimpleNamespace(const=lambda value: value)}):
            spec.loader.exec_module(driver)
        rom = bytes([0x28, 0, 0, 0, 0, 0, 0, 0])
        for raw, resolution, expected in ((0x197, 0, 25), (0x197, 1, 25.25),
                                          (0x197, 2, 25.375), (0x197, 3, 25.4375),
                                          (0xFF5F, 0, -10.5), (0xFF5F, 3, -10.0625)):
            scratch = bytes([raw & 255, raw >> 8, 0, 0, (resolution << 5) | 31, 0, 0, 0, 0])
            sensor = driver.DS18X20(Wire(scratch))
            self.assertEqual(sensor.read_temp(rom), expected)


if __name__ == "__main__":
    unittest.main()
