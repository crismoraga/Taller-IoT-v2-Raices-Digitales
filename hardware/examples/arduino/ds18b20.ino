#include <OneWire.h>
#include <DallasTemperature.h>
OneWire bus(5);
DallasTemperature sensor(&bus);
void setup() { Serial.begin(115200); sensor.begin(); }
void loop() {
  sensor.requestTemperatures(); float value = sensor.getTempCByIndex(0);
  bool ok = value != DEVICE_DISCONNECTED_C;
  Serial.print("{\"sensor\":\"soil_temperature\",\"value\":");
  if (ok) Serial.print(value); else Serial.print("null");
  Serial.print(",\"unit\":\"°C\",\"status\":\""); Serial.print(ok ? "READING" : "NO_RESPONSE"); Serial.println("\"}"); delay(1000);
}
