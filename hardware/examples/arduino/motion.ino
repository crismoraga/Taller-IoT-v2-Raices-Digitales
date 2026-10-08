void setup() { Serial.begin(115200); pinMode(9, INPUT); }
void loop() {
  int value = digitalRead(9);
  Serial.print("{\"sensor\":\"motion\",\"value\":"); Serial.print(value);
  Serial.println(",\"unit\":\"0/1\",\"status\":\"UNVERIFIED\"}"); delay(500);
}
