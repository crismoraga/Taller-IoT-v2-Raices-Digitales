void setup() { Serial.begin(115200); pinMode(6, INPUT); }
void loop() {
  int value = 1 - digitalRead(6);
  Serial.print("{\"sensor\":\"rain\",\"value\":"); Serial.print(value);
  Serial.println(",\"unit\":\"0/1\",\"status\":\"UNVERIFIED\"}"); delay(500);
}
