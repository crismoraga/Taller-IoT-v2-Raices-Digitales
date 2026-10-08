void setup() { Serial.begin(115200); }
void loop() {
  long total = 0;
  for (int i = 0; i < 16; i++) total += analogRead(A2);
  int raw = total / 16;
  Serial.print("{\"sensor\":\"water_level\",\"value\":null,\"raw\":");
  Serial.print(raw);
  Serial.println(",\"unit\":\"%\",\"status\":\"NEEDS_CALIBRATION\"}");
  delay(1000);
}
