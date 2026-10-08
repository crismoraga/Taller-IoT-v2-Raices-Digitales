void setup() { Serial.begin(115200); pinMode(7, OUTPUT); pinMode(8, INPUT); }
void loop() {
  digitalWrite(7, LOW); delayMicroseconds(2); digitalWrite(7, HIGH); delayMicroseconds(10); digitalWrite(7, LOW);
  unsigned long us = pulseIn(8, HIGH, 30000); float cm = us * 0.0343 / 2;
  Serial.print("{\"sensor\":\"distance\",\"value\":"); if (us) Serial.print(cm); else Serial.print("null");
  Serial.print(",\"unit\":\"cm\",\"status\":\""); Serial.print(!us ? "NO_RESPONSE" : (cm >= 2 && cm <= 400 ? "READING" : "OUT_OF_RANGE")); Serial.println("\"}"); delay(200);
}
