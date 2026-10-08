const byte SIGNAL=10;
void setup() { Serial.begin(115200); pinMode(SIGNAL,OUTPUT); const int widths[]={1300,1500,1700,1500}; for(byte w=0;w<4;w++) { Serial.print("Pulso us: "); Serial.println(widths[w]); for(byte i=0;i<25;i++) { digitalWrite(SIGNAL,HIGH); delayMicroseconds(widths[w]); digitalWrite(SIGNAL,LOW); delayMicroseconds(20000-widths[w]); } } digitalWrite(SIGNAL,LOW); }
void loop() {}
