"""Execute the real station sketch with a native fake Arduino HAL.

This validates parser, sensor isolation, ROM search and emitted JSON. It does
not validate board voltages, pulse timing or a physically attached USB device.
"""
import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest


HEADER = r'''
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <deque>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>
struct __FlashStringHelper {};
#define F(s) reinterpret_cast<const __FlashStringHelper*>(s)
constexpr uint8_t A0=14,A1=15,A2=16,INPUT=0,OUTPUT=1,LOW=0,HIGH=1;
extern unsigned long clockMillis, clockMicros;
extern std::deque<uint8_t> busReads;
extern int pinValues[20];
extern bool uartStartedDuringDHT;
class SerialPort {
public:
  std::string input;
  size_t position=0;
  std::ostringstream output;
  void begin(int) {}
  int available() { return input.size()-position; }
  char read() { return input[position++]; }
  void print(const __FlashStringHelper* text) { output << reinterpret_cast<const char*>(text); }
  void print(char text) { output << text; }
  void print(int value) { output << value; }
  void print(float value,int digits) { output << std::fixed << std::setprecision(digits) << value; }
  void println(const __FlashStringHelper* text) { print(text); output << '\n'; }
};
extern SerialPort Serial;
inline unsigned long millis() { return clockMillis; }
inline unsigned long micros() { return ++clockMicros; }
inline void delay(unsigned long value) { clockMicros+=value*1000; }
inline void delayMicroseconds(unsigned long value) { clockMicros+=value; }
inline void noInterrupts() {}
inline void interrupts() {}
inline void pinMode(uint8_t,int) {}
inline void digitalWrite(uint8_t pin,int value) { pinValues[pin]=value; }
inline int digitalRead(uint8_t pin) {
  if (pin==5 && !busReads.empty()) { int value=busReads.front(); busReads.pop_front(); return value; }
  if (pin==4) {
    if (!Serial.output.str().empty()) uartStartedDuringDHT=true;
    return HIGH;
  }
  return pin==5 || pin==6 ? HIGH : pinValues[pin];
}
inline int analogRead(uint8_t) { return 512; }
inline unsigned long pulseIn(uint8_t,int,unsigned long) { return 0; }
#define constrain(value,minimum,maximum) ((value)<(minimum)?(minimum):((value)>(maximum)?(maximum):(value)))
'''

HARNESS = r'''
#include <iostream>
#include <array>
#include "Arduino.h"
unsigned long clockMillis=0,clockMicros=0;
std::deque<uint8_t> busReads;
int pinValues[20]={};
bool uartStartedDuringDHT=false;
SerialPort Serial;
const bool ENABLE_SOIL=true,ENABLE_LIGHT=true,ENABLE_WATER=true,ENABLE_RAIN=true,ENABLE_PIR=true;
const bool ENABLE_DS=true,ENABLE_DISTANCE=true,ENABLE_DHT=true,ENABLE_AIR_TEMP=true,ENABLE_AIR_HUMIDITY=true;
const int SOIL_DRY=900,SOIL_WET=100,LIGHT_DRY=-1,LIGHT_WET=-1,WATER_DRY=100,WATER_WET=900;
#include "station.ino"
using ROM=std::array<uint8_t,8>;
ROM rom(uint8_t family,uint8_t serial) {
  ROM value={family,serial,0,0,0,0,0,0};
  value[7]=crc8(value.data(),7);
  return value;
}
void searchPass(std::vector<ROM> active,const ROM& selected) {
  busReads.push_back(LOW); // Reset presence pulse.
  for (int bit=0;bit<64;++bit) {
    bool allOne=true,allZero=true;
    for (const ROM& value:active) {
      bool high=(value[bit>>3]>>(bit&7))&1;
      allOne=allOne&&high;allZero=allZero&&!high;
    }
    busReads.push_back(allOne);busReads.push_back(allZero);
    bool chosen=(selected[bit>>3]>>(bit&7))&1;
    active.erase(std::remove_if(active.begin(),active.end(),[&](const ROM& value) {
      return bool((value[bit>>3]>>(bit&7))&1)!=chosen;
    }),active.end());
  }
}
int main(int argc,char** argv) {
  std::string scenario=argv[1];
  if (scenario=="sample") {
    setup();clockMillis=2000;loop();
    if (uartStartedDuringDHT) return 9;
    std::cout<<Serial.output.str();
  } else if (scenario=="commands") {
    Serial.input=std::string("STOP\0X\n",7);loop();if(stopped) return 2;
    Serial.input+="STOP_TOO_LONG\n";loop();if(stopped) return 3;
    Serial.input+="STOP\r\n";loop();if(!stopped) return 4;
    Serial.input+=std::string("RUN\0X\n",6);loop();if(!stopped) return 5;
    Serial.input+="\nRUN\n";loop();if(stopped) return 6;
    std::cout<<"commands-ok";
  } else if (scenario=="search") {
    ROM other=rom(0x10,1),valid=rom(0x28,2);
    searchPass({other,valid},other);searchPass({other,valid},valid);
    if(!discoverDS18B20() || !std::equal(valid.begin(),valid.end(),dsROM) || !busReads.empty()) return 7;
    std::cout<<"valid-ds18b20";
  } else if (scenario=="badcrc") {
    ROM bad=rom(0x28,2);bad[7]^=1;
    searchPass({bad},bad);
    if(discoverDS18B20()) return 8;
    std::cout<<"crc-rejected";
  } else if (scenario=="resolution") {
    conversionPending=true;conversionStarted=0;clockMillis=2000;
    uint8_t scratch[9]={0x97,0x01,0,0,0x1f,0,0,0,0};scratch[8]=crc8(scratch,8);
    busReads.push_back(LOW);
    for (uint8_t value:scratch) for(int bit=0;bit<8;++bit) busReads.push_back((value>>bit)&1);
    temperatureReading();std::cout<<Serial.output.str();
  } else if (scenario=="pir") {
    clockMillis=60001;loop();Serial.output.str("");
    clockMillis=2000;lastSample=0;loop();std::cout<<Serial.output.str();
  }
}
'''


@unittest.skipUnless(shutil.which("g++"), "Native Arduino runtime checks need g++")
class ArduinoRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workspace = tempfile.TemporaryDirectory(prefix="raices-firmware-hal-")
        root = pathlib.Path(cls.workspace.name)
        (root / "Arduino.h").write_text(HEADER)
        (root / "runtime.cpp").write_text(HARNESS)
        source = pathlib.Path(__file__).resolve().parents[2] / "firmware" / "arduino" / "station.ino"
        shutil.copyfile(source, root / "station.ino")
        cls.binary = root / "runtime"
        compile_result = subprocess.run(["g++", "-std=c++17", "-I", str(root), str(root / "runtime.cpp"), "-o", str(cls.binary)],
                                        capture_output=True, text=True, timeout=30)
        if compile_result.returncode:
            raise AssertionError(compile_result.stderr)

    @classmethod
    def tearDownClass(cls):
        cls.workspace.cleanup()

    def execute(self, scenario):
        return subprocess.run([str(self.binary), scenario], check=True, capture_output=True,
                              text=True, timeout=5).stdout

    def test_missing_modules_leave_one_parseable_frame_with_healthy_analog_values(self):
        frame = json.loads(self.execute("sample"))
        rows = {row["sensor"]: row for row in frame["readings"]}
        self.assertEqual(len(rows), 9)
        self.assertEqual(rows["soil"]["status"], "READING")
        self.assertEqual(rows["light"]["status"], "READING")
        self.assertEqual(rows["air_temperature"]["status"], "NO_RESPONSE")
        self.assertEqual(rows["distance"]["status"], "NO_RESPONSE")
        self.assertEqual(rows["soil_temperature"]["status"], "NO_RESPONSE")
        self.assertEqual(frame["diagnostics"]["transport"], "USB")

    def test_noisy_or_oversized_commands_do_not_execute_a_valid_prefix(self):
        self.assertEqual(self.execute("commands"), "commands-ok")

    def test_search_finds_a_ds18b20_after_a_different_sensor_family(self):
        self.assertEqual(self.execute("search"), "valid-ds18b20")
        self.assertEqual(self.execute("badcrc"), "crc-rejected")

    def test_nine_bit_conversion_ignores_undefined_low_bits(self):
        row = json.loads(self.execute("resolution"))
        self.assertEqual(row["value"], 25)
        self.assertEqual(row["status"], "READING")

    def test_pir_warmup_does_not_restart_when_uptime_wraps(self):
        frame = json.loads(self.execute("pir"))
        motion = next(row for row in frame["readings"] if row["sensor"] == "motion")
        self.assertEqual(motion["value"], 0)
        self.assertNotIn("error", motion)


if __name__ == "__main__":
    unittest.main()
