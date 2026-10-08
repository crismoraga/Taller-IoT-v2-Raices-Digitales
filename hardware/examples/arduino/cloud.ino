void setup() { Serial.begin(115200); }
void loop() {
  long total = 0;
  for (int i = 0; i < 16; i++) total += analogRead(A0);
  int raw = total / 16;
  Serial.print("{\"sensor\":\"soil\",\"value\":null,\"raw\":");
  Serial.print(raw);
  Serial.println(",\"unit\":\"%\",\"status\":\"NEEDS_CALIBRATION\"}");
  delay(1000);
}
