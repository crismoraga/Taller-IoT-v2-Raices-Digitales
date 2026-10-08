void setup() { pinMode(5, OUTPUT); pinMode(6, OUTPUT); pinMode(7, OUTPUT); }
void sendByte(byte v) { digitalWrite(7, LOW); shiftOut(5, 6, MSBFIRST, v); digitalWrite(7, HIGH); }
void loop() { sendByte(1); delay(500); sendByte(0); delay(500); }
