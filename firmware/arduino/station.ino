// Raices Digitales: Arduino Uno/Nano ATmega328P, real USB telemetry.
// Configuration constants are generated above this sketch by the browser.
// Pico W GPIOs are 3.3 V only. Arduino ECHO may be connected directly at 5 V.
#include <Arduino.h>
#include <math.h>

const uint8_t DHT_PIN = 4, DS_PIN = 5, RAIN_PIN = 6;
const uint8_t TRIG_PIN = 7, ECHO_PIN = 8, PIR_PIN = 9;
bool firstReading = true, stopped = false;
unsigned long lastSample = 0, conversionStarted = 0;
bool conversionPending = false;
uint8_t dsROM[8];

void emitReading(const __FlashStringHelper* sensor, float value,
                 const __FlashStringHelper* unit, const __FlashStringHelper* status,
                 int raw, const __FlashStringHelper* error) {
  if (!firstReading) Serial.print(',');
  firstReading = false;
  Serial.print(F("{\"sensor\":\"")); Serial.print(sensor);
  Serial.print(F("\",\"value\":"));
  if (isnan(value)) Serial.print(F("null")); else Serial.print(value, 2);
  Serial.print(F(",\"unit\":\"")); Serial.print(unit);
  Serial.print(F("\",\"status\":\"")); Serial.print(status); Serial.print('"');
  if (raw >= 0) { Serial.print(F(",\"raw\":")); Serial.print(raw); }
  if (error) { Serial.print(F(",\"error\":\"")); Serial.print(error); Serial.print('"'); }
  Serial.print('}');
}

int medianADC(uint8_t pin) {
  int samples[9];
  for (uint8_t i = 0; i < 9; ++i) samples[i] = analogRead(pin);
  for (uint8_t i = 1; i < 9; ++i) {
    int value = samples[i]; int8_t j = i - 1;
    while (j >= 0 && samples[j] > value) { samples[j + 1] = samples[j]; --j; }
    samples[j + 1] = value;
  }
  return samples[4];
}

void analogReading(const __FlashStringHelper* id, uint8_t pin, bool enabled,
                   int dry, int wet, bool relativeLight) {
  if (!enabled) { emitReading(id, NAN, F("%"), F("DISABLED"), -1, nullptr); return; }
  int raw = medianADC(pin);
  if (raw <= 2 || raw >= 1021) {
    emitReading(id, NAN, F("%"), F("UNVERIFIED"), raw, F("Senal cerca de un riel; presencia no verificable")); return;
  }
  if (relativeLight && (dry < 0 || wet < 0)) {
    emitReading(id, raw * 100.0 / 1023.0, F("%"), F("READING"), raw, nullptr); return;
  }
  if (dry < 0 || wet < 0 || abs(wet - dry) < 8) {
    emitReading(id, NAN, F("%"), F("NEEDS_CALIBRATION"), raw, F("Configura referencias ADC 0-1023")); return;
  }
  float value = (raw - dry) * 100.0 / (wet - dry);
  const __FlashStringHelper* status = (value < -15 || value > 115) ? F("OUT_OF_RANGE") : F("READING");
  emitReading(id, constrain(value, 0.0, 100.0), F("%"), status, raw, nullptr);
}

bool waitDHT(uint8_t level, unsigned int timeout) {
  unsigned long start = micros();
  while (digitalRead(DHT_PIN) != level) if (micros() - start >= timeout) return false;
  return true;
}

bool readDHT11(float* temperature, float* humidity) {
  uint8_t bytes[5] = {0, 0, 0, 0, 0};
  pinMode(DHT_PIN, OUTPUT); digitalWrite(DHT_PIN, LOW); delay(18);
  // Release to the external 3.3 V pull-up; do not drive a 3.3 V sensor at 5 V.
  pinMode(DHT_PIN, INPUT); delayMicroseconds(30);
  if (!waitDHT(LOW, 110) || !waitDHT(HIGH, 110) || !waitDHT(LOW, 110)) return false;
  for (uint8_t bit = 0; bit < 40; ++bit) {
    if (!waitDHT(HIGH, 100)) return false;
    unsigned long start = micros();
    if (!waitDHT(LOW, 100)) return false;
    bytes[bit / 8] = (bytes[bit / 8] << 1) | ((micros() - start) > 40);
  }
  if ((uint8_t)(bytes[0] + bytes[1] + bytes[2] + bytes[3]) != bytes[4]) return false;
  *humidity = bytes[0] + bytes[1] * 0.1;
  *temperature = (bytes[2] & 0x7f) + bytes[3] * 0.1;
  if (bytes[2] & 0x80) *temperature = -*temperature;
  return true;
}

bool oneWireReset() {
  pinMode(DS_PIN, OUTPUT); digitalWrite(DS_PIN, LOW); delayMicroseconds(480);
  noInterrupts(); pinMode(DS_PIN, INPUT); delayMicroseconds(70);
  bool present = digitalRead(DS_PIN) == LOW; interrupts(); delayMicroseconds(410);
  return present;
}

void oneWireBit(bool value) {
  noInterrupts(); pinMode(DS_PIN, OUTPUT); digitalWrite(DS_PIN, LOW);
  delayMicroseconds(value ? 6 : 60); pinMode(DS_PIN, INPUT);
  interrupts(); delayMicroseconds(value ? 64 : 10);
}

uint8_t oneWireReadBit() {
  noInterrupts(); pinMode(DS_PIN, OUTPUT); digitalWrite(DS_PIN, LOW); delayMicroseconds(3);
  pinMode(DS_PIN, INPUT); delayMicroseconds(10); uint8_t value = digitalRead(DS_PIN);
  interrupts(); delayMicroseconds(53); return value;
}

void oneWireByte(uint8_t value) {
  for (uint8_t bit = 0; bit < 8; ++bit) { oneWireBit(value & 1); value >>= 1; }
}

uint8_t oneWireReadByte() {
  uint8_t value = 0;
  for (uint8_t bit = 0; bit < 8; ++bit) value |= oneWireReadBit() << bit;
  return value;
}

uint8_t crc8(const uint8_t* data, uint8_t length) {
  uint8_t crc = 0;
  for (uint8_t i = 0; i < length; ++i) {
    uint8_t value = data[i];
    for (uint8_t bit = 0; bit < 8; ++bit) {
      bool mix = (crc ^ value) & 1; crc >>= 1;
      if (mix) crc ^= 0x8c;
      value >>= 1;
    }
  }
  return crc;
}

bool discoverDS18B20() {
  // Genuine Search ROM; chooses one valid DS18B20 when several share the bus.
  if (!oneWireReset()) return false;
  oneWireByte(0xf0);
  for (uint8_t bit = 0; bit < 64; ++bit) {
    uint8_t value = oneWireReadBit(), inverse = oneWireReadBit();
    if (value && inverse) return false;
    uint8_t chosen = value == inverse ? 0 : value;
    uint8_t mask = 1 << (bit & 7);
    if (chosen) dsROM[bit >> 3] |= mask; else dsROM[bit >> 3] &= ~mask;
    oneWireBit(chosen);
  }
  return dsROM[0] == 0x28 && crc8(dsROM, 8) == 0;
}

void selectDS() {
  oneWireByte(0x55);
  for (uint8_t i = 0; i < 8; ++i) oneWireByte(dsROM[i]);
}

void startDSConversion() {
  conversionPending = ENABLE_DS && discoverDS18B20();
  if (conversionPending && oneWireReset()) {
    selectDS(); oneWireByte(0x44); conversionStarted = millis();
  } else conversionPending = false;
}

void temperatureReading() {
  if (!ENABLE_DS) { emitReading(F("soil_temperature"), NAN, F("°C"), F("DISABLED"), -1, nullptr); return; }
  if (!conversionPending || millis() - conversionStarted < 750 || !oneWireReset()) {
    emitReading(F("soil_temperature"), NAN, F("°C"), F("NO_RESPONSE"), -1, F("Sin ROM DS18B20 o conversion pendiente")); return;
  }
  selectDS(); oneWireByte(0xbe);
  uint8_t scratch[9];
  for (uint8_t i = 0; i < 9; ++i) scratch[i] = oneWireReadByte();
  if (crc8(scratch, 9) != 0) {
    emitReading(F("soil_temperature"), NAN, F("°C"), F("NO_RESPONSE"), -1, F("CRC DS18B20 invalido")); return;
  }
  int16_t raw = (scratch[1] << 8) | scratch[0]; float value = raw / 16.0;
  emitReading(F("soil_temperature"), value, F("°C"), value == 85 ? F("UNVERIFIED") : (value < -55 || value > 125 ? F("OUT_OF_RANGE") : F("READING")), -1, nullptr);
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT); pinMode(3, OUTPUT); digitalWrite(2, LOW); digitalWrite(3, LOW);
  if (ENABLE_RAIN) pinMode(RAIN_PIN, INPUT);
  if (ENABLE_PIR) pinMode(PIR_PIN, INPUT);
  if (ENABLE_DISTANCE) { pinMode(TRIG_PIN, OUTPUT); digitalWrite(TRIG_PIN, LOW); pinMode(ECHO_PIN, INPUT); }
  startDSConversion();
}

void loop() {
  // STOP command is actually supported by this station sketch; hardware stays safe.
  static char command[8]; static uint8_t commandLength = 0;
  while (Serial.available()) {
    char byte = Serial.read();
    if (byte == '\n') {
      command[commandLength] = 0;
      if (!strcmp(command, "STOP")) { stopped = true; digitalWrite(2, LOW); digitalWrite(3, LOW); Serial.println(F("Estacion detenida; envia RUN para continuar.")); }
      if (!strcmp(command, "RUN")) { stopped = false; startDSConversion(); }
      commandLength = 0;
    } else if (byte != '\r' && commandLength < sizeof(command) - 1) command[commandLength++] = byte;
  }
  if (stopped || millis() - lastSample < 2000) return;
  lastSample = millis(); firstReading = true;
  Serial.print(F("{\"readings\":["));
  analogReading(F("soil"), A0, ENABLE_SOIL, SOIL_DRY, SOIL_WET, false);
  analogReading(F("light"), A1, ENABLE_LIGHT, LIGHT_DRY, LIGHT_WET, true);
  analogReading(F("water_level"), A2, ENABLE_WATER, WATER_DRY, WATER_WET, false);
  temperatureReading();
  float temperature = NAN, humidity = NAN;
  bool dhtValid = ENABLE_DHT && readDHT11(&temperature, &humidity);
  if (ENABLE_AIR_TEMP) emitReading(F("air_temperature"), temperature, F("°C"), !ENABLE_DHT ? F("DISABLED") : !dhtValid ? F("NO_RESPONSE") : temperature < 0 || temperature > 50 ? F("OUT_OF_RANGE") : F("READING"), -1, nullptr);
  else emitReading(F("air_temperature"), NAN, F("°C"), F("DISABLED"), -1, nullptr);
  if (ENABLE_AIR_HUMIDITY) emitReading(F("air_humidity"), humidity, F("%"), !ENABLE_DHT ? F("DISABLED") : !dhtValid ? F("NO_RESPONSE") : humidity < 20 || humidity > 90 ? F("OUT_OF_RANGE") : F("READING"), -1, nullptr);
  else emitReading(F("air_humidity"), NAN, F("%"), F("DISABLED"), -1, nullptr);
  int rain = ENABLE_RAIN ? digitalRead(RAIN_PIN) : -1;
  emitReading(F("rain"), ENABLE_RAIN ? 1 - rain : NAN, F("0/1"), ENABLE_RAIN ? F("UNVERIFIED") : F("DISABLED"), rain, nullptr);
  if (ENABLE_PIR) emitReading(F("motion"), millis() < 60000 ? NAN : digitalRead(PIR_PIN), F("0/1"), F("UNVERIFIED"), -1, millis() < 60000 ? F("PIR estabilizando 60 segundos") : nullptr);
  else emitReading(F("motion"), NAN, F("0/1"), F("DISABLED"), -1, nullptr);
  if (ENABLE_DISTANCE) {
    digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2); digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN, LOW);
    unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    float cm = duration ? duration / 58.0 : NAN;
    emitReading(F("distance"), cm, F("cm"), !duration ? F("NO_RESPONSE") : cm < 2 || cm > 400 ? F("OUT_OF_RANGE") : F("READING"), -1, !duration ? F("Sin eco; revisa rango y cableado") : nullptr);
  } else emitReading(F("distance"), NAN, F("cm"), F("DISABLED"), -1, nullptr);
  Serial.println(F("],\"diagnostics\":{\"transport\":\"USB\",\"firmware\":\"1.0.0-arduino\",\"wifi\":\"Uno/Nano usa el puente USB del navegador\"}}"));
  startDSConversion();
}
