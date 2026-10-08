void setup() { Serial.begin(115200); }
void loop() { float volts = analogRead(A0) * 5.0 / 1023.0; Serial.print("LM35 °C: "); Serial.println(volts * 100); delay(1000); }
