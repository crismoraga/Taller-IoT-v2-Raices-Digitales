#include <DHT.h>
DHT sensor(4, DHT11);
void emit(const char* name, float value, const char* unit) {
  Serial.print("{\"sensor\":\""); Serial.print(name); Serial.print("\",\"value\":");
  if (isnan(value)) Serial.print("null"); else Serial.print(value);
  Serial.print(",\"unit\":\""); Serial.print(unit);
  Serial.print("\",\"status\":\""); Serial.print(isnan(value) ? "NO_RESPONSE" : "READING"); Serial.println("\"}");
}
void setup() { Serial.begin(115200); sensor.begin(); }
void loop() { delay(2000); emit("air_temperature", sensor.readTemperature(), "°C"); emit("air_humidity", sensor.readHumidity(), "%"); }
