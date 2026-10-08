void setup() { pinMode(3,OUTPUT); digitalWrite(3,LOW); for(byte i=0;i<2;i++) { digitalWrite(3,HIGH); delay(150); digitalWrite(3,LOW); delay(200); } }
void loop() {}
