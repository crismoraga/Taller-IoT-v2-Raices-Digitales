void setup() { Serial.begin(115200); pinMode(12, INPUT_PULLUP); }
void loop() { Serial.print("DO optico: "); Serial.println(digitalRead(12)); delay(100); }
